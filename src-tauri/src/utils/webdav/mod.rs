//! 通用 WebDAV 模块 — 独立的 WebDAV 协议实现，可挂载到任何 Axum 应用。
//!
//! # 使用示例
//!
//! ```ignore
//! use crate::utils::webdav::{WebDav, WebDavConfig};
//!
//! let dav = WebDav::new(WebDavConfig {
//!     root: PathBuf::from("/shared-files"),
//!     show_hidden: false,
//!     max_depth: -1,
//!     auth_user: Some("admin".into()),
//!     auth_pass: Some("123".into()),
//!     read_only: false,
//! });
//!
//! let app = Router::new()
//!     .route("/", any(dav.handle_root()))
//!     .route("/{*path}", any(dav.handle_path()));
//! ```

mod handlers;
mod resource;

use axum::body::Body;
use axum::extract::Path;
use axum::http::{HeaderMap, Method, Response};
use std::path::PathBuf;
use std::sync::Arc;

/// WebDAV 配置。创建时注入，之后模块内部自行使用，无需外部 state。
#[derive(Clone)]
pub struct WebDavConfig {
    /// 共享的根目录绝对路径
    pub root: PathBuf,
    /// 是否显示隐藏文件（以 . 开头的文件/目录）
    pub show_hidden: bool,
    /// 最大目录深度，-1 表示不限制
    pub max_depth: i32,
    /// Basic Auth 用户名（None 表示不开启认证）
    pub auth_user: Option<String>,
    /// Basic Auth 密码
    pub auth_pass: Option<String>,
    /// 无认证时只允许浏览和下载，禁止上传、删除、移动等写操作。
    pub read_only: bool,
}

/// 通用 WebDAV 服务实例。
///
/// 创建后通过 `handle_root()` 和 `handle_path()` 获取 Axum handler，
/// 挂载到 router 即可工作。
#[derive(Clone)]
pub struct WebDav {
    config: Arc<WebDavConfig>,
}

impl WebDav {
    pub fn new(config: WebDavConfig) -> Self {
        Self {
            config: Arc::new(config),
        }
    }

    /// 处理根路径 `/` 的 WebDAV 请求。
    pub async fn handle_root(
        &self,
        method: Method,
        headers: HeaderMap,
        body: Body,
    ) -> Response<Body> {
        handlers::dispatch(&self.config, method.as_str(), "", &headers, body).await
    }

    /// 处理子路径 `/{*path}` 的 WebDAV 请求。
    pub async fn handle_path(
        &self,
        method: Method,
        Path(path): Path<String>,
        headers: HeaderMap,
        body: Body,
    ) -> Response<Body> {
        let rel_path = percent_encoding::percent_decode_str(&path)
            .decode_utf8_lossy()
            .to_string();
        handlers::dispatch(&self.config, method.as_str(), &rel_path, &headers, body).await
    }
}
