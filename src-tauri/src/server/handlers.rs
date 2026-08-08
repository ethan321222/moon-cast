use axum::body::Body;
use axum::extract::{Path, RawQuery, State};
use axum::http::{HeaderMap, HeaderValue, Response, header};
use axum::response::IntoResponse;
use serde::Serialize;
use std::path::PathBuf;
use std::sync::Arc;

use super::directory;
use crate::utils::error::AppError;
use crate::utils::mime;
use crate::utils::path::safe_resolve;
use crate::utils::range;
use super::spa;

pub struct AppState {
    pub root: PathBuf,
    pub show_hidden: bool,
    pub max_depth: i32,
    pub speed_limit: Option<u64>,
    pub webdav: bool,
    pub auth_enabled: bool,
    pub auth_user: Option<String>,
    pub auth_pass: Option<String>,
}

/// JSON 响应包装器，包含目录列表 + 服务器能力。
#[derive(Serialize)]
struct DirResponse {
    #[serde(flatten)]
    listing: directory::DirListing,
    webdav: bool,
    webdav_auth: bool,
}

fn dir_response(listing: directory::DirListing, state: &AppState) -> DirResponse {
    DirResponse {
        listing,
        webdav: state.webdav,
        webdav_auth: state.auth_enabled
            && state
                .auth_user
                .as_deref()
                .map(str::trim)
                .is_some_and(|value| !value.is_empty())
            && state
                .auth_pass
                .as_deref()
                .map(str::trim)
                .is_some_and(|value| !value.is_empty()),
    }
}

/// 判断请求是否是 AJAX（前端 fetch 请求带 X-Requested-With 头）。
fn is_ajax(headers: &HeaderMap) -> bool {
    headers
        .get("X-Requested-With")
        .and_then(|v| v.to_str().ok())
        .map(|v| v.eq_ignore_ascii_case("XMLHttpRequest"))
        .unwrap_or(false)
}

/// 根路径处理器：AJAX 返回 JSON，普通浏览器返回 SPA HTML。
pub async fn serve_index(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Response<Body> {
    if !is_ajax(&headers) {
        // 外部浏览器访问，返回 SPA 入口页面
        return spa::serve_index_html().await;
    }

    let full_path = &state.root;
    if full_path.is_dir() {
        let mut resp = match directory::list_directory(&state.root, "", state.show_hidden, state.max_depth).await {
            Ok(listing) => axum::Json(dir_response(listing, &state)).into_response(),
            Err(e) => e.into_response_for(&headers),
        };
        resp.headers_mut()
            .insert(header::VARY, HeaderValue::from_static("X-Requested-With"));
        resp
    } else {
        AppError::NotFound("Root is not a directory".into()).into_response_for(&headers)
    }
}

/// 路径处理器：目录返回 JSON 列表（AJAX）或 SPA HTML，文件返回流式内容。
pub async fn serve_path(
    State(state): State<Arc<AppState>>,
    Path(path): Path<String>,
    RawQuery(query): RawQuery,
    headers: HeaderMap,
) -> Response<Body> {
    // 先检查是否请求的是 SPA 静态资源（JS/CSS/SVG 等）
    if is_spa_asset(&path) {
        return spa::serve_embedded_file(&path, query.as_deref()).await;
    }

    let rel_path = percent_encoding::percent_decode_str(&path)
        .decode_utf8_lossy()
        .to_string();

    let resolved = match safe_resolve(&state.root, &rel_path, state.show_hidden, state.max_depth).await {
        Ok(p) => p,
        Err(e) => {
            // 如果是普通浏览器请求且路径解析失败，返回 SPA（让前端路由处理）
            if !is_ajax(&headers) {
                return spa::serve_index_html().await;
            }
            return e.into_response_for(&headers);
        }
    };

    if resolved.is_dir() {
        if !is_ajax(&headers) {
            // 外部浏览器请求目录路径，返回 SPA
            return spa::serve_index_html().await;
        }
        let mut resp = match directory::list_directory(&state.root, &rel_path, state.show_hidden, state.max_depth).await {
            Ok(listing) => axum::Json(dir_response(listing, &state)).into_response(),
            Err(e) => e.into_response_for(&headers),
        };
        resp.headers_mut()
            .insert(header::VARY, HeaderValue::from_static("X-Requested-With"));
        resp
    } else if resolved.is_file() {
        let mime = mime::detect_mime(&resolved);
        let content_type = if mime::is_text(&mime) {
            format!("{}; charset=utf-8", mime)
        } else {
            mime.to_string()
        };
        match range::build_range_response(&resolved, &headers, &content_type, state.speed_limit).await {
            Ok(resp) => resp,
            Err(e) => AppError::from(e).into_response_for(&headers),
        }
    } else {
        AppError::NotFound("Path not found".into()).into_response_for(&headers)
    }
}

/// 检查路径是否为 SPA 的静态资源（Vite 打包产物）。
#[cfg(not(debug_assertions))]
fn is_spa_asset(path: &str) -> bool {
    path.starts_with("assets/")
        || path == "vite.svg"
        || path == "tauri.svg"
        || path == "favicon.ico"
        || path == "logo.png"
}

/// Debug 模式下，额外匹配 Vite dev server 的模块路径。
#[cfg(debug_assertions)]
fn is_spa_asset(path: &str) -> bool {
    path.starts_with("assets/")
        || path.starts_with("src/")
        || path.starts_with("node_modules/")
        || path.starts_with("@vite/")
        || path.starts_with("@react-refresh")
        || path == "vite.svg"
        || path == "tauri.svg"
        || path == "favicon.ico"
        || path == "logo.png"
}
