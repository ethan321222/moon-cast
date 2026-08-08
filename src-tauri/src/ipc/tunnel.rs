use crate::tunnel::{TunnelKind, TunnelStatus};
use crate::tunnel::cloudflared;
use crate::tunnel::installer;
use crate::utils::logger_next as logger;
use std::path::PathBuf;
use tauri::State;

use super::state::{AppState, BinaryStatus};

/// 检查 cloudflared 是否可用。
#[tauri::command]
pub async fn check_tunnel_binary(
    state: State<'_, AppState>,
    tunnel_bin: Option<String>,
) -> Result<BinaryStatus, String> {
    logger::log(&format!("[IPC] check_tunnel_binary, tunnel_bin: {:?}", tunnel_bin));
    let path = resolve_binary_path(tunnel_bin, &state.app_data_dir);
    Ok(BinaryStatus {
        available: path.exists(),
        path: if path.exists() { Some(path.to_string_lossy().to_string()) } else { None },
    })
}

/// 下载 cloudflared。
#[tauri::command]
pub async fn download_tunnel_binary(state: State<'_, AppState>) -> Result<BinaryStatus, String> {
    logger::log("[IPC] download_tunnel_binary");
    let path = installer::check_or_download(&state.app_data_dir)
        .await
        .map_err(|e| e.to_string())?;
    Ok(BinaryStatus {
        available: true,
        path: Some(path.to_string_lossy().to_string()),
    })
}

/// 启动隧道。
#[tauri::command]
pub async fn start_tunnel(
    state: State<'_, AppState>,
    tunnel_bin: Option<String>,
    port: u16,
) -> Result<TunnelStatus, String> {
    logger::log(&format!("[IPC] start_tunnel, tunnel_bin: {:?}, port: {}", tunnel_bin, port));
    let mut tunnel = state.tunnel.lock().await;
    if tunnel.is_some() {
        return Err("Tunnel is already running".into());
    }

    let binary = resolve_binary_path(tunnel_bin, &state.app_data_dir);
    let binary = if binary.exists() {
        binary
    } else {
        installer::check_or_download(&state.app_data_dir)
            .await
            .map_err(|e| e.to_string())?
    };

    let handle = cloudflared::start(&binary, port).await?;
    let status = handle.status();
    *tunnel = Some(handle);

    Ok(status)
}

/// 解析二进制路径：用指定路径，没指定就用默认目录。
fn resolve_binary_path(tunnel_bin: Option<String>, app_data_dir: &std::path::PathBuf) -> PathBuf {
    match tunnel_bin {
        Some(p) => PathBuf::from(p),
        None => {
            let name = if cfg!(target_os = "windows") { "cloudflared.exe" } else { "cloudflared" };
            app_data_dir.join("bin").join(name)
        }
    }
}

/// 停止隧道。
#[tauri::command]
pub async fn stop_tunnel(state: State<'_, AppState>) -> Result<TunnelStatus, String> {
    logger::log("[IPC] stop_tunnel");
    let mut tunnel = state.tunnel.lock().await;
    if let Some(handle) = tunnel.take() {
        handle.stop().await;
    }
    Ok(TunnelStatus {
        running: false,
        public_url: None,
        kind: TunnelKind::Cloudflare,
    })
}

/// 获取隧道状态。
#[tauri::command]
pub async fn get_tunnel_status(state: State<'_, AppState>) -> Result<TunnelStatus, String> {
    logger::log("[IPC] get_tunnel_status");
    let tunnel = state.tunnel.lock().await;
    match tunnel.as_ref() {
        Some(handle) => Ok(handle.status()),
        None => Ok(TunnelStatus {
            running: false,
            public_url: None,
            kind: TunnelKind::Cloudflare,
        }),
    }
}

/// 打开隧道配置文件（用系统默认编辑器）。
#[tauri::command]
pub async fn open_tunnel_config(state: State<'_, AppState>) -> Result<String, String> {
    logger::log("[IPC] open_tunnel_config");
    let path = cloudflared::ensure_config_file(&state.app_data_dir)?;
    opener::open(path.to_string_lossy().as_ref())
        .map_err(|e| format!("Failed to open config file: {}", e))?;
    Ok(path.to_string_lossy().to_string())
}
