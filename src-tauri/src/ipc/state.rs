use crate::server::ServerHandle;
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::tunnel::TunnelHandle;

/// 应用状态，由 Tauri 管理。
pub struct AppState {
    pub server: Arc<Mutex<Option<ServerHandle>>>,
    pub log_rx: Arc<Mutex<Option<tokio::sync::broadcast::Receiver<String>>>>,
    pub tunnel: Arc<Mutex<Option<TunnelHandle>>>,
    pub app_data_dir: std::path::PathBuf,
}

/// 服务器状态 DTO，返回给前端。
#[derive(Serialize)]
pub struct ServerStatus {
    pub running: bool,
    pub local_addr: Option<String>,
    pub root: String,
    pub port: u16,
}

/// 局域网地址 DTO。
#[derive(Serialize)]
pub struct LanAddress {
    pub ip: String,
    pub port: u16,
    pub url: String,
}

/// 地址事件，通过 Tauri event 推送给前端。
#[derive(Clone, Serialize)]
pub struct AddressEvent {
    pub id: String,
    pub kind: String,
    pub status: String,
    #[serde(rename = "statusText", skip_serializing_if = "Option::is_none")]
    pub status_text: Option<String>,
    pub name: String,
    pub url: Option<String>,
    pub error: Option<String>,
}

/// 隧道二进制可用性 DTO。
#[derive(Serialize)]
pub struct BinaryStatus {
    pub available: bool,
    pub path: Option<String>,
}
