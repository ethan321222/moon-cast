pub mod utils;
pub mod ipc;
pub mod server;
pub mod tunnel;

use ipc::state::AppState;
use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};
use tokio::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            setup_state(app);
            setup_tray(app)?;
            setup_window_close(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ipc::server::start_server,
            ipc::server::stop_server,
            ipc::server::get_server_status,
            ipc::server::get_lan_addresses,
            ipc::server::get_log_dir_path,
            ipc::server::read_logs,
            ipc::server::get_desktop_path,
            ipc::server::get_app_data_bin_path,
            ipc::tunnel::check_tunnel_binary,
            ipc::tunnel::download_tunnel_binary,
            ipc::tunnel::start_tunnel,
            ipc::tunnel::stop_tunnel,
            ipc::tunnel::get_tunnel_status,
            ipc::tunnel::open_tunnel_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// 初始化应用状态。
fn setup_state(app: &tauri::App) {
    let app_data_dir = app.path().app_data_dir()
        .expect("Failed to resolve app data dir");
    std::fs::create_dir_all(&app_data_dir).ok();

    // 初始化日志
    utils::logger_next::init(&app_data_dir);
    utils::logger_next::log("MoonCast started");

    app.manage(AppState {
        server: Arc::new(Mutex::new(None)),
        log_rx: Arc::new(Mutex::new(None)),
        tunnel: Arc::new(Mutex::new(None)),
        app_data_dir,
    });
}

/// 配置系统托盘图标和菜单。
fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let open_item = MenuItem::with_id(app, "open", "Open", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open_item, &quit_item])?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("MoonCast")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::DoubleClick { .. } = event {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}

/// 关闭窗口时隐藏到托盘而非退出。
fn setup_window_close(app: &tauri::App) {
    let window = app.get_webview_window("main").unwrap();
    let window_clone = window.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = window_clone.hide();
        }
    });
}
