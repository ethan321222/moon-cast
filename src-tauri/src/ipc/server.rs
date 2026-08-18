use std::path::Path;
use crate::server::config::ServerConfig;
use crate::server;
use crate::tunnel::cloudflared;
use crate::tunnel::installer;
use crate::utils::logging::LogTarget;
use crate::utils::logger_next as logger;
use crate::utils::net;
use tauri::{AppHandle, Emitter, Manager, State};

use super::state::{AddressEvent, AppState, LanAddress, ServerStatus};

/// 检测二进制文件是否可执行。
/// Windows 上试跑 --version，失败则说明文件被锁定或损坏。
fn can_execute(binary: &Path) -> bool {
    std::process::Command::new(binary)
        .arg("--version")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// 启动服务器，通过事件逐个推送地址。
///
/// - `config` — 由前端传入的完整服务器配置
#[tauri::command]
pub async fn start_server(
    state: State<'_, AppState>,
    app_handle: AppHandle,
    config: ServerConfig,
) -> Result<ServerStatus, String> {
    if config.auth_enabled {
        let has_user = config
            .auth_user
            .as_deref()
            .map(str::trim)
            .is_some_and(|value| !value.is_empty());
        let has_pass = config
            .auth_pass
            .as_deref()
            .map(str::trim)
            .is_some_and(|value| !value.is_empty());

        if !has_user || !has_pass {
            return Err("ERR_AUTH_CREDENTIALS_REQUIRED".into());
        }
    }

    logger::log(&format!(
        "[IPC] start_server, root: {:?}, bind: {}, port: {}, show_hidden: {}, max_depth: {}, speed_limit: {:?}, webdav: {}, auth_enabled: {}, auth_user: {:?}, tunnel_enabled: {}, tunnel_bin: {:?}",
        config.root, config.bind, config.port, config.show_hidden, config.max_depth, config.speed_limit, config.webdav, config.auth_enabled, config.auth_user, config.tunnel_enabled, config.tunnel_bin
    ));
    let mut server_guard = state.server.lock().await;
    if server_guard.is_some() {
        return Err("Server is already running".into());
    }

    let (log_target, log_rx) = LogTarget::channel(1000);

    {
        let mut rx_guard = state.log_rx.lock().await;
        *rx_guard = Some(log_rx);
    }

    let handle = server::run(config.clone(), log_target)
        .await
        .map_err(|e| format!("Failed to start server: {}", e))?;

    let local_addr = handle.local_addr;
    *server_guard = Some(handle);
    drop(server_guard);

    let port = local_addr.port();

    // Emit local address
    let _ = app_handle.emit("address-ready", AddressEvent {
        id: "local".to_string(),
        kind: "local".to_string(),
        status: "ready".to_string(),
        status_text: None,
        name: "local".to_string(),
        url: Some(format!("http://127.0.0.1:{}/", port)),
        error: None,
    });

    // Emit LAN addresses one by one
    let ips = net::local_ips();
    logger::log(&format!("[IPC] local_ips result: {:?}", ips));
    for ip in &ips {
        let _ = app_handle.emit("address-ready", AddressEvent {
            id: format!("lan-{}", ip),
            kind: "lan".to_string(),
            status: "ready".to_string(),
            status_text: None,
            name: "lan".to_string(),
            url: Some(format!("http://{}:{}", ip, port)),
            error: None,
        });
    }

    // If tunnel is enabled, emit loading then spawn async task
    if config.tunnel_enabled {
        let _ = app_handle.emit("address-ready", AddressEvent {
            id: "tunnel".to_string(),
            kind: "tunnel".to_string(),
            status: "loading".to_string(),
            status_text: Some("checking_cloudflared".to_string()),
            name: "tunnel".to_string(),
            url: None,
            error: None,
        });

        let tunnel_state = state.tunnel.clone();
        let tunnel_bin = config.tunnel_bin.clone();
        let app_data_dir = state.app_data_dir.clone();
        let app_handle_clone = app_handle.clone();

        tokio::spawn(async move {
            // 直接用 tunnel_bin 路径
            let binary = match tunnel_bin {
                Some(ref p) => std::path::PathBuf::from(p),
                None => app_data_dir.join("bin").join(if cfg!(target_os = "windows") { "cloudflared.exe" } else { "cloudflared" }),
            };

            // 文件不存在或无法执行就重新下载
            let binary = if binary.exists() && can_execute(&binary) {
                binary
            } else {
                let _ = app_handle_clone.emit("address-ready", AddressEvent {
                    id: "tunnel".to_string(),
                    kind: "tunnel".to_string(),
                    status: "loading".to_string(),
                    status_text: Some("downloading_cloudflared".to_string()),
                    name: "tunnel".to_string(),
                    url: None,
                    error: None,
                });

                match installer::check_or_download(&app_data_dir).await {
                    Ok(path) => path,
                    Err(e) => {
                        let _ = app_handle_clone.emit("address-ready", AddressEvent {
                            id: "tunnel".to_string(),
                            kind: "tunnel".to_string(),
                            status: "error".to_string(),
                            status_text: None,
                            name: "tunnel".to_string(),
                            url: None,
                            error: Some(format!("ERR_DOWNLOAD_FAILED:{}", e)),
                        });
                        return;
                    }
                }
            };

            // 二进制就绪，启动隧道
            let _ = app_handle_clone.emit("address-ready", AddressEvent {
                id: "tunnel".to_string(),
                kind: "tunnel".to_string(),
                status: "loading".to_string(),
                status_text: Some("starting_tunnel".to_string()),
                name: "tunnel".to_string(),
                url: None,
                error: None,
            });

            match cloudflared::start(&binary, port).await {
                Ok(handle) => {
                    let status = handle.status();
                    let _ = app_handle_clone.emit("address-ready", AddressEvent {
                        id: "tunnel".to_string(),
                        kind: "tunnel".to_string(),
                        status: "ready".to_string(),
                        status_text: None,
                        name: "tunnel".to_string(),
                        url: status.public_url,
                        error: None,
                    });
                    let mut tunnel = tunnel_state.lock().await;
                    *tunnel = Some(handle);
                }
                Err(e) => {
                    let _ = app_handle_clone.emit("address-ready", AddressEvent {
                        id: "tunnel".to_string(),
                        kind: "tunnel".to_string(),
                        status: "error".to_string(),
                        status_text: None,
                        name: "tunnel".to_string(),
                        url: None,
                        error: Some(e),
                    });
                }
            }
        });
    }

    Ok(ServerStatus {
        running: true,
        local_addr: Some(local_addr.to_string()),
        root: config.root.to_string_lossy().to_string(),
        port,
    })
}

/// 停止服务器。
#[tauri::command]
pub async fn stop_server(state: State<'_, AppState>) -> Result<(), String> {
    logger::log("[IPC] stop_server");
    // 停止隧道（如果正在运行）
    let mut tunnel = state.tunnel.lock().await;
    if let Some(handle) = tunnel.take() {
        handle.stop().await;
    }
    drop(tunnel);

    let mut server_guard = state.server.lock().await;
    if let Some(handle) = server_guard.take() {
        handle.stop().await;
    }

    Ok(())
}

/// 获取服务器运行状态。
#[tauri::command]
pub async fn get_server_status(state: State<'_, AppState>) -> Result<bool, String> {
    logger::log("[IPC] get_server_status");
    let server_guard = state.server.lock().await;
    Ok(server_guard.is_some())
}

/// 获取局域网地址列表。
///
/// - `port` — 由前端传入当前服务器端口
#[tauri::command]
pub async fn get_lan_addresses(port: u16) -> Result<Vec<LanAddress>, String> {
    logger::log(&format!("[IPC] get_lan_addresses, port: {}", port));
    let ips = net::local_ips();

    let addresses: Vec<LanAddress> = ips
        .iter()
        .map(|ip| LanAddress {
            ip: ip.to_string(),
            port,
            url: format!("http://{}:{}", ip, port),
        })
        .collect();

    Ok(addresses)
}

/// 获取系统桌面路径（跨平台）。
#[tauri::command]
pub async fn get_desktop_path() -> Result<String, String> {
    logger::log("[IPC] get_desktop_path");
    Ok(crate::utils::path::desktop_dir().to_string_lossy().to_string())
}

/// 获取应用数据目录下的 bin 路径（cloudflared 默认存放位置）。
#[tauri::command]
pub async fn get_app_data_bin_path(app_handle: AppHandle) -> Result<String, String> {
    logger::log("[IPC] get_app_data_bin_path");
    app_handle.path().app_data_dir()
        .map(|p| p.join("bin").to_string_lossy().to_string())
        .map_err(|e| format!("ERR_APP_DATA_DIR:{}", e))
}

/// 获取日志目录路径。
#[tauri::command]
pub async fn get_log_dir_path(app_handle: AppHandle) -> Result<String, String> {
    logger::log("[IPC] get_log_dir_path");
    app_handle.path().app_data_dir()
        .map(|p| p.join("logs").to_string_lossy().to_string())
        .map_err(|e| format!("ERR_LOG_DIR:{}", e))
}

/// 读取日志消息（非阻塞）。
#[tauri::command]
pub async fn read_logs(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    logger::log("[IPC] read_logs");
    let mut rx_guard = state.log_rx.lock().await;
    if let Some(rx) = rx_guard.as_mut() {
        let mut logs = Vec::new();
        while let Ok(line) = rx.try_recv() {
            logs.push(line);
        }
        Ok(logs)
    } else {
        Ok(Vec::new())
    }
}
