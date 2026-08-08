use axum::body::Body;
use axum::http::{HeaderMap, Response, StatusCode, Uri, header};

use crate::utils::encoding::{XmlWriter, base64_decode};
use crate::utils::error::AppError;
use crate::utils::fs::{self, SortOptions};
use crate::utils::{mime, range};
use crate::utils::path::{safe_resolve, safe_resolve_parent, path_depth};

use super::resource::{DavResource, dir_to_resource, file_to_resource, entry_to_resource};
use super::WebDavConfig;

const DAV_HEADER: &str = "1, 2";
const ALLOW_METHODS: &str =
    "OPTIONS, GET, HEAD, PUT, DELETE, MKCOL, COPY, MOVE, PROPFIND, PROPPATCH, LOCK, UNLOCK";
const READ_ONLY_ALLOW_METHODS: &str = "OPTIONS, GET, HEAD, PROPFIND";

// ============ 公开的分发入口 ============

pub(super) async fn dispatch(
    config: &WebDavConfig,
    method: &str,
    rel_path: &str,
    headers: &HeaderMap,
    body: Body,
) -> Response<Body> {
    if let Err(resp) = check_auth(config, headers) {
        return resp;
    }

    if config.read_only && is_write_method(method) {
        return read_only_forbidden();
    }

    match method {
        "GET" => handle_get(config, rel_path, headers, true).await,
        "HEAD" => handle_get(config, rel_path, headers, false).await,
        "PROPFIND" => handle_propfind(config, rel_path, headers).await,
        "OPTIONS" => handle_options(config),
        "LOCK" => handle_lock(headers),
        "UNLOCK" => handle_unlock(),
        "PUT" => handle_put(config, rel_path, body).await,
        "DELETE" => handle_delete(config, rel_path).await,
        "MKCOL" => handle_mkcol(config, rel_path).await,
        "COPY" => handle_copy(config, rel_path, headers).await,
        "MOVE" => handle_move(config, rel_path, headers).await,
        "PROPPATCH" => handle_proppatch(rel_path),
        _ => method_not_allowed(),
    }
}

fn is_write_method(method: &str) -> bool {
    matches!(
        method,
        "PUT" | "DELETE" | "MKCOL" | "COPY" | "MOVE" | "PROPPATCH" | "LOCK" | "UNLOCK"
    )
}

// ============ 认证 ============

fn check_auth(config: &WebDavConfig, headers: &HeaderMap) -> Result<(), Response<Body>> {
    let expected_user = match &config.auth_user {
        Some(u) => u,
        None => return Ok(()),
    };
    let expected_pass = config.auth_pass.as_deref().unwrap_or("");

    let auth_header = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok());

    let authorized = match auth_header {
        Some(val) if val.starts_with("Basic ") => match base64_decode(&val[6..]) {
            Some(decoded) => {
                if let Some((user, pass)) = decoded.split_once(':') {
                    user == expected_user && pass == expected_pass
                } else {
                    false
                }
            }
            None => false,
        },
        _ => false,
    };

    if authorized {
        Ok(())
    } else {
        Err(Response::builder()
            .status(StatusCode::UNAUTHORIZED)
            .header("WWW-Authenticate", "Basic realm=\"webdav\"")
            .header("DAV", DAV_HEADER)
            .header(header::CONTENT_LENGTH, "0")
            .body(Body::empty())
            .expect("building 401 response"))
    }
}

// ============ OPTIONS / LOCK / UNLOCK ============

fn handle_options(config: &WebDavConfig) -> Response<Body> {
    Response::builder()
        .status(StatusCode::OK)
        .header("DAV", DAV_HEADER)
        .header("Allow", if config.read_only { READ_ONLY_ALLOW_METHODS } else { ALLOW_METHODS })
        .header("MS-Author-Via", "DAV")
        .header(header::CONTENT_LENGTH, "0")
        .body(Body::empty())
        .expect("building OPTIONS response")
}

async fn handle_get(
    config: &WebDavConfig,
    rel_path: &str,
    headers: &HeaderMap,
    include_body: bool,
) -> Response<Body> {
    let resolved = match safe_resolve(&config.root, rel_path, config.show_hidden, config.max_depth).await {
        Ok(p) => p,
        Err(e) => return error_response(e),
    };

    if !resolved.is_file() {
        return method_not_allowed();
    }

    let mime = mime::detect_mime(&resolved);
    let content_type = if mime::is_text(&mime) {
        format!("{}; charset=utf-8", mime)
    } else {
        mime.to_string()
    };

    if include_body {
        match range::build_range_response(&resolved, headers, &content_type, None).await {
            Ok(resp) => resp,
            Err(e) => error_response(AppError::from(e)),
        }
    } else {
        match tokio::fs::metadata(&resolved).await {
            Ok(metadata) => Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, content_type)
                .header(header::CONTENT_LENGTH, metadata.len())
                .header(header::ACCEPT_RANGES, "bytes")
                .body(Body::empty())
                .expect("building HEAD response"),
            Err(e) => error_response(AppError::from(e)),
        }
    }
}

fn handle_lock(headers: &HeaderMap) -> Response<Body> {
    let timeout = headers
        .get("Timeout")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("Second-3600");

    let lock_token = "opaquelocktoken:webdav-lock";

    let mut w = XmlWriter::new();
    w.declaration()
        .open("D:prop xmlns:D=\"DAV:\"")
        .open("D:lockdiscovery")
        .open("D:activelock")
        .raw("<D:locktype><D:write/></D:locktype>\n")
        .raw("<D:lockscope><D:exclusive/></D:lockscope>\n")
        .tag("D:depth", "infinity")
        .raw("<D:owner><D:href>anonymous</D:href></D:owner>\n")
        .tag("D:timeout", timeout)
        .raw(&format!(
            "<D:locktoken><D:href>{}</D:href></D:locktoken>\n",
            lock_token
        ))
        .raw("<D:lockroot><D:href>/</D:href></D:lockroot>\n")
        .close("D:activelock")
        .close("D:lockdiscovery")
        .close("D:prop");

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/xml; charset=utf-8")
        .header("Lock-Token", format!("<{}>", lock_token))
        .header("DAV", DAV_HEADER)
        .body(Body::from(w.finish()))
        .expect("building LOCK response")
}

fn handle_unlock() -> Response<Body> {
    Response::builder()
        .status(StatusCode::NO_CONTENT)
        .header("DAV", DAV_HEADER)
        .body(Body::empty())
        .expect("building UNLOCK response")
}

fn method_not_allowed() -> Response<Body> {
    Response::builder()
        .status(StatusCode::METHOD_NOT_ALLOWED)
        .header(header::CONTENT_LENGTH, "0")
        .body(Body::empty())
        .expect("building 405 response")
}

fn read_only_forbidden() -> Response<Body> {
    error_response(AppError::Forbidden(
        "WebDAV is read-only because authentication is not enabled".into(),
    ))
}

// ============ PUT ============

async fn handle_put(config: &WebDavConfig, rel_path: &str, body: Body) -> Response<Body> {
    let target = match safe_resolve_parent(&config.root, rel_path, config.show_hidden, config.max_depth).await {
        Ok(p) => p,
        Err(e) => return error_response(e),
    };

    let existed = target.exists();

    use http_body_util::BodyExt;
    let bytes = match body.collect().await {
        Ok(collected) => collected.to_bytes(),
        Err(e) => return error_response(AppError::Internal(format!("Failed to read request body: {}", e))),
    };

    let data = bytes.to_vec();
    match tokio::task::spawn_blocking(move || std::fs::write(&target, &data)).await {
        Ok(Ok(())) => {}
        Ok(Err(e)) => return error_response(AppError::from(e)),
        Err(e) => return error_response(AppError::Internal(format!("Task join error: {}", e))),
    }

    let status = if existed { StatusCode::NO_CONTENT } else { StatusCode::CREATED };
    dav_response(status)
}

// ============ DELETE ============

async fn handle_delete(config: &WebDavConfig, rel_path: &str) -> Response<Body> {
    let resolved = match safe_resolve(&config.root, rel_path, config.show_hidden, config.max_depth).await {
        Ok(p) => p,
        Err(e) => return error_response(e),
    };

    let is_dir = resolved.is_dir();
    match tokio::task::spawn_blocking(move || {
        if is_dir { std::fs::remove_dir_all(&resolved) } else { std::fs::remove_file(&resolved) }
    }).await {
        Ok(Ok(())) => {}
        Ok(Err(e)) => return error_response(AppError::from(e)),
        Err(e) => return error_response(AppError::Internal(format!("Task join error: {}", e))),
    }

    dav_response(StatusCode::NO_CONTENT)
}

// ============ MKCOL ============

async fn handle_mkcol(config: &WebDavConfig, rel_path: &str) -> Response<Body> {
    let target = match safe_resolve_parent(&config.root, rel_path, config.show_hidden, config.max_depth).await {
        Ok(p) => p,
        Err(e) => return error_response(e),
    };

    if target.exists() {
        return error_response(AppError::Conflict("Resource already exists".into()));
    }

    match tokio::task::spawn_blocking(move || std::fs::create_dir(&target)).await {
        Ok(Ok(())) => {}
        Ok(Err(e)) => return error_response(AppError::from(e)),
        Err(e) => return error_response(AppError::Internal(format!("Task join error: {}", e))),
    }

    dav_response(StatusCode::CREATED)
}

// ============ COPY ============

async fn handle_copy(config: &WebDavConfig, rel_path: &str, headers: &HeaderMap) -> Response<Body> {
    let dest_rel = match parse_destination(headers) {
        Ok(d) => d,
        Err(resp) => return resp,
    };
    let overwrite = parse_overwrite(headers);

    let source = match safe_resolve(&config.root, rel_path, config.show_hidden, config.max_depth).await {
        Ok(p) => p,
        Err(e) => return error_response(e),
    };
    let dest = match safe_resolve_parent(&config.root, &dest_rel, config.show_hidden, config.max_depth).await {
        Ok(p) => p,
        Err(e) => return error_response(e),
    };

    let dest_existed = dest.exists();
    if dest_existed && !overwrite {
        return error_response(AppError::Conflict("Destination exists and Overwrite is F".into()));
    }

    let is_dir = source.is_dir();
    match tokio::task::spawn_blocking(move || {
        if is_dir {
            copy_dir_recursive(&source, &dest)
        } else {
            if dest_existed && dest.is_dir() { std::fs::remove_dir_all(&dest)?; }
            std::fs::copy(&source, &dest)?;
            Ok(())
        }
    }).await {
        Ok(Ok(())) => {}
        Ok(Err(e)) => return error_response(AppError::from(e)),
        Err(e) => return error_response(AppError::Internal(format!("Task join error: {}", e))),
    }

    let status = if dest_existed { StatusCode::NO_CONTENT } else { StatusCode::CREATED };
    dav_response(status)
}

// ============ MOVE ============

async fn handle_move(config: &WebDavConfig, rel_path: &str, headers: &HeaderMap) -> Response<Body> {
    let dest_rel = match parse_destination(headers) {
        Ok(d) => d,
        Err(resp) => return resp,
    };
    let overwrite = parse_overwrite(headers);

    let source = match safe_resolve(&config.root, rel_path, config.show_hidden, config.max_depth).await {
        Ok(p) => p,
        Err(e) => return error_response(e),
    };
    let dest = match safe_resolve_parent(&config.root, &dest_rel, config.show_hidden, config.max_depth).await {
        Ok(p) => p,
        Err(e) => return error_response(e),
    };

    let dest_existed = dest.exists();
    if dest_existed && !overwrite {
        return error_response(AppError::Conflict("Destination exists and Overwrite is F".into()));
    }

    match tokio::task::spawn_blocking(move || {
        if dest_existed {
            if dest.is_dir() { std::fs::remove_dir_all(&dest)?; } else { std::fs::remove_file(&dest)?; }
        }
        std::fs::rename(&source, &dest)
    }).await {
        Ok(Ok(())) => {}
        Ok(Err(e)) => return error_response(AppError::from(e)),
        Err(e) => return error_response(AppError::Internal(format!("Task join error: {}", e))),
    }

    let status = if dest_existed { StatusCode::NO_CONTENT } else { StatusCode::CREATED };
    dav_response(status)
}

// ============ PROPPATCH ============

fn handle_proppatch(rel_path: &str) -> Response<Body> {
    let href = if rel_path.is_empty() { "/".to_string() } else { format!("/{}", rel_path.trim_start_matches('/')) };

    let mut w = XmlWriter::new();
    w.declaration()
        .open_attr("D:multistatus", "xmlns:D=\"DAV:\"")
        .open("D:response")
        .tag("D:href", &href)
        .open("D:propstat")
        .empty("D:prop")
        .tag("D:status", "HTTP/1.1 200 OK")
        .close("D:propstat")
        .close("D:response")
        .close("D:multistatus");

    Response::builder()
        .status(StatusCode::MULTI_STATUS)
        .header(header::CONTENT_TYPE, "application/xml; charset=utf-8")
        .header("DAV", DAV_HEADER)
        .body(Body::from(w.finish()))
        .expect("building PROPPATCH response")
}

// ============ PROPFIND ============

async fn handle_propfind(config: &WebDavConfig, rel_path: &str, headers: &HeaderMap) -> Response<Body> {
    let depth = parse_depth(headers);

    let normalized_rel: String = rel_path.split('/').filter(|s| !s.is_empty()).collect::<Vec<_>>().join("/");
    let rel_path = normalized_rel.as_str();

    let resolved = match safe_resolve(&config.root, rel_path, config.show_hidden, config.max_depth).await {
        Ok(p) => p,
        Err(e) => return error_response(e),
    };

    let mut resources: Vec<DavResource> = Vec::new();

    if resolved.is_dir() {
        let dir_href = if rel_path.is_empty() { "/".to_string() } else { format!("/{}/", rel_path) };

        let resolved_clone = resolved.clone();
        let dir_href_clone = dir_href.clone();
        match tokio::task::spawn_blocking(move || dir_to_resource(&resolved_clone, &dir_href_clone)).await {
            Ok(Ok(res)) => resources.push(res),
            Ok(Err(e)) => return error_response(AppError::from(e)),
            Err(e) => return error_response(AppError::Internal(format!("Task join error: {}", e))),
        }

        if depth >= 1 {
            let full_path = resolved.clone();
            let parent_rel = normalized_rel.clone();
            let show_hidden = config.show_hidden;
            let max_depth = config.max_depth;

            match tokio::task::spawn_blocking(move || {
                let current_depth = path_depth(&parent_rel);
                let sort = SortOptions::default();
                fs::list_dir(&full_path, &parent_rel, show_hidden, max_depth, current_depth, &sort)
            }).await {
                Ok(Ok(entries)) => {
                    for entry in &entries {
                        let encoded_name = percent_encoding::utf8_percent_encode(
                            &entry.name,
                            percent_encoding::NON_ALPHANUMERIC,
                        ).to_string();
                        let child_href = if entry.is_dir {
                            format!("{}{}/", dir_href, encoded_name)
                        } else {
                            format!("{}{}", dir_href, encoded_name)
                        };
                        resources.push(entry_to_resource(entry, &child_href));
                    }
                }
                Ok(Err(e)) => return error_response(e),
                Err(e) => return error_response(AppError::Internal(format!("Task join error: {}", e))),
            }
        }
    } else if resolved.is_file() {
        let file_href = if rel_path.is_empty() { "/".to_string() } else { format!("/{}", rel_path.trim_start_matches('/')) };

        let resolved_clone = resolved.clone();
        let file_href_clone = file_href.clone();
        match tokio::task::spawn_blocking(move || file_to_resource(&resolved_clone, &file_href_clone)).await {
            Ok(Ok(res)) => resources.push(res),
            Ok(Err(e)) => return error_response(AppError::from(e)),
            Err(e) => return error_response(AppError::Internal(format!("Task join error: {}", e))),
        }
    } else {
        return error_response(AppError::NotFound("Path not found".into()));
    }

    let mut w = XmlWriter::new();
    w.declaration().open_attr("D:multistatus", "xmlns:D=\"DAV:\"");
    for res in &resources {
        w.raw(&res.to_xml());
    }
    w.close("D:multistatus");

    Response::builder()
        .status(StatusCode::MULTI_STATUS)
        .header(header::CONTENT_TYPE, "application/xml; charset=utf-8")
        .header("DAV", DAV_HEADER)
        .body(Body::from(w.finish()))
        .expect("building PROPFIND response")
}

// ============ 辅助函数 ============

fn parse_depth(headers: &HeaderMap) -> u32 {
    headers
        .get("Depth")
        .and_then(|v| v.to_str().ok())
        .map(|v| match v.trim() { "0" => 0, "1" => 1, _ => 1 })
        .unwrap_or(1)
}

#[allow(clippy::result_large_err)]
fn parse_destination(headers: &HeaderMap) -> Result<String, Response<Body>> {
    let dest_str = headers
        .get("Destination")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| error_response(AppError::BadRequest("Missing Destination header".into())))?;

    let path = if let Ok(uri) = dest_str.parse::<Uri>() {
        uri.path().to_string()
    } else {
        dest_str.to_string()
    };

    let decoded = percent_encoding::percent_decode_str(&path)
        .decode_utf8_lossy()
        .to_string();

    Ok(decoded)
}

fn parse_overwrite(headers: &HeaderMap) -> bool {
    headers
        .get("Overwrite")
        .and_then(|v| v.to_str().ok())
        .map(|v| v.trim() != "F")
        .unwrap_or(true)
}

fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
    if dst.exists() { std::fs::remove_dir_all(dst)?; }
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let target = dst.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir_recursive(&entry.path(), &target)?;
        } else {
            std::fs::copy(entry.path(), &target)?;
        }
    }
    Ok(())
}

/// 构建简单的 DAV 成功响应（无 body）。
fn dav_response(status: StatusCode) -> Response<Body> {
    Response::builder()
        .status(status)
        .header("DAV", DAV_HEADER)
        .header(header::CONTENT_LENGTH, "0")
        .body(Body::empty())
        .expect("building dav response")
}

/// 将 AppError 转换为 WebDAV XML 错误响应。
fn error_response(err: AppError) -> Response<Body> {
    let (status, message) = match &err {
        AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg.clone()),
        AppError::Forbidden(msg) => (StatusCode::FORBIDDEN, msg.clone()),
        AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
        AppError::Conflict(msg) => (StatusCode::CONFLICT, msg.clone()),
        AppError::Internal(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg.clone()),
    };

    let mut w = XmlWriter::new();
    w.declaration()
        .open("D:error xmlns:D=\"DAV:\"")
        .tag("D:message", &message)
        .close("D:error");

    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, "application/xml; charset=utf-8")
        .header("DAV", DAV_HEADER)
        .body(Body::from(w.finish()))
        .expect("building error response")
}
