use serde::{Deserialize, Serialize};
use tauri::State;

use crate::ipc::state::AppState;
use crate::server::config::ServerConfig;
use crate::utils::store::Store;

// ─── Data Models ────────────────────────────────────────────────────────────

/// Application-level configuration.
///
/// Composes `ServerConfig` (flattened) with UI preferences (theme, language).
/// Persisted as `config.json` in the app data directory.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AppConfig {
    #[serde(flatten)]
    pub server: ServerConfig,
    pub theme: String,
    pub lang: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            server: ServerConfig::default(),
            theme: "system".to_string(),
            lang: "system".to_string(),
        }
    }
}

/// Runtime status snapshot.
///
/// Written by the app on server start/stop so external tools (or a future
/// headless mode) can discover the current state by reading `status.json`.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AppStatus {
    pub running: bool,
    pub addresses: Vec<ServiceAddress>,
}

/// A single accessible address exposed by the running server.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceAddress {
    pub label: String,
    pub url: String,
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CONFIG_FILE: &str = "config.json";
const STATUS_FILE: &str = "status.json";

// ─── Helpers ────────────────────────────────────────────────────────────────

/// Build a `Store` pointing to `config.json` in the app data directory.
pub fn config_store(app_data_dir: &std::path::Path) -> Store {
    Store::new(app_data_dir, CONFIG_FILE)
}

/// Build a `Store` pointing to `status.json` in the app data directory.
pub fn status_store(app_data_dir: &std::path::Path) -> Store {
    Store::new(app_data_dir, STATUS_FILE)
}

// ─── IPC Commands ───────────────────────────────────────────────────────────

/// Load the persisted application config (or defaults if not yet saved).
#[tauri::command]
pub async fn load_app_config(state: State<'_, AppState>) -> Result<AppConfig, String> {
    let store = config_store(&state.app_data_dir);
    Ok(store.load())
}

/// Persist the application config to disk.
#[tauri::command]
pub async fn save_app_config(
    state: State<'_, AppState>,
    config: AppConfig,
) -> Result<(), String> {
    let store = config_store(&state.app_data_dir);
    store.save(&config).map_err(|e| e.to_string())
}

/// Read the current runtime status (running state + addresses).
#[tauri::command]
pub async fn get_app_status(state: State<'_, AppState>) -> Result<AppStatus, String> {
    let store = status_store(&state.app_data_dir);
    Ok(store.load())
}

/// Return the config.json file path.
#[tauri::command]
pub async fn get_config_file_path(state: State<'_, AppState>) -> Result<String, String> {
    Ok(config_store(&state.app_data_dir).path().to_string_lossy().to_string())
}
