use std::path::PathBuf;

/// 服务器启动配置，是 server::run 所需的一切信息的唯一来源。
/// 与 AppState 分离，因为它携带处理器不需要的网络细节（bind/port）。
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(default)]
pub struct ServerConfig {
    pub root: PathBuf,
    pub bind: String,
    pub port: u16,
    pub show_hidden: bool,
    pub max_depth: i32,
    pub speed_limit: Option<u64>,
    pub webdav: bool,
    pub auth_enabled: bool,
    pub auth_user: Option<String>,
    pub auth_pass: Option<String>,
    pub tunnel_enabled: bool,
    pub tunnel_bin: Option<String>,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            root: crate::utils::path::desktop_dir(),
            bind: "0.0.0.0".to_string(),
            port: 8080,
            show_hidden: false,
            max_depth: -1,
            speed_limit: None,
            webdav: false,
            auth_enabled: false,
            auth_user: None,
            auth_pass: None,
            tunnel_enabled: false,
            tunnel_bin: None,
        }
    }
}

impl ServerConfig {
    /// `bind:port` 字符串，适用于 TcpListener::bind。
    pub fn bind_addr(&self) -> String {
        format!("{}:{}", self.bind, self.port)
    }

    /// 是否绑定到通配符地址（所有接口）。
    pub fn is_wildcard_bind(&self) -> bool {
        self.bind == "0.0.0.0" || self.bind == "::"
    }
}
