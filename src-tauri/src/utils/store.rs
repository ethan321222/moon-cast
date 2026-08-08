use serde::{de::DeserializeOwned, Serialize};
use std::path::{Path, PathBuf};

/// 通用的本地 JSON 配置持久化工具。
///
/// 将任意可序列化的结构体以 JSON 格式存储到本地文件，
/// 启动时读取，更新时写回。
///
/// # 使用示例
///
/// ```ignore
/// use crate::utils::store::Store;
/// use crate::server::config::ServerConfig;
///
/// // 创建 store 实例，指定存储目录和文件名
/// let store = Store::new(&app_data_dir, "config.json");
///
/// // 读取配置（文件不存在则返回默认值）
/// let config: ServerConfig = store.load();
///
/// // 修改后保存
/// config.port = 9090;
/// store.save(&config)?;
///
/// // 也可以一步到位：加载 → 修改 → 保存
/// store.update(|config: &mut ServerConfig| {
///     config.port = 9090;
///     config.tunnel_bin = Some("/usr/local/bin/cloudflared".into());
/// })?;
/// ```
pub struct Store {
    path: PathBuf,
}

impl Store {
    /// 创建 Store 实例。
    ///
    /// - `dir` — 存储目录（如 app_data_dir），会自动创建
    /// - `filename` — 文件名（如 "config.json"）
    pub fn new(dir: &Path, filename: &str) -> Self {
        Self {
            path: dir.join(filename),
        }
    }

    /// 从指定的完整路径创建 Store。
    pub fn from_path(path: PathBuf) -> Self {
        Self { path }
    }

    /// 获取配置文件路径。
    pub fn path(&self) -> &Path {
        &self.path
    }

    /// 加载配置。
    ///
    /// - 文件不存在 → 返回 `T::default()`
    /// - 文件存在但解析失败 → 返回 `T::default()`（不会 panic）
    pub fn load<T: DeserializeOwned + Default>(&self) -> T {
        match std::fs::read_to_string(&self.path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => T::default(),
        }
    }

    /// 加载配置，区分错误原因。
    ///
    /// - 文件不存在 → `Ok(T::default())`
    /// - 文件读取/解析失败 → `Err(StoreError)`
    pub fn load_strict<T: DeserializeOwned + Default>(&self) -> Result<T, StoreError> {
        match std::fs::read_to_string(&self.path) {
            Ok(content) => {
                serde_json::from_str(&content).map_err(|e| StoreError::Parse(e.to_string()))
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(T::default()),
            Err(e) => Err(StoreError::Io(e.to_string())),
        }
    }

    /// 保存配置到文件（覆盖写入，自动创建父目录）。
    pub fn save<T: Serialize>(&self, data: &T) -> Result<(), StoreError> {
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| StoreError::Io(e.to_string()))?;
        }

        let json = serde_json::to_string_pretty(data)
            .map_err(|e| StoreError::Serialize(e.to_string()))?;

        std::fs::write(&self.path, json)
            .map_err(|e| StoreError::Io(e.to_string()))?;

        Ok(())
    }

    /// 加载 → 修改 → 保存，一步到位。
    pub fn update<T, F>(&self, f: F) -> Result<T, StoreError>
    where
        T: DeserializeOwned + Serialize + Default + Clone,
        F: FnOnce(&mut T),
    {
        let mut data: T = self.load();
        f(&mut data);
        self.save(&data)?;
        Ok(data)
    }

    /// 删除配置文件（如果存在）。
    pub fn delete(&self) -> Result<(), StoreError> {
        match std::fs::remove_file(&self.path) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(e) => Err(StoreError::Io(e.to_string())),
        }
    }

    /// 配置文件是否存在。
    pub fn exists(&self) -> bool {
        self.path.exists()
    }
}

/// Store 操作错误。
#[derive(Debug)]
pub enum StoreError {
    Io(String),
    Parse(String),
    Serialize(String),
}

impl std::fmt::Display for StoreError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StoreError::Io(msg) => write!(f, "IO error: {}", msg),
            StoreError::Parse(msg) => write!(f, "Parse error: {}", msg),
            StoreError::Serialize(msg) => write!(f, "Serialize error: {}", msg),
        }
    }
}

impl std::error::Error for StoreError {}
