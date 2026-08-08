use axum::body::Body;
use axum::http::{Response, StatusCode, header};

#[cfg(not(debug_assertions))]
use axum::http::HeaderValue;

// ==================== Release 模式：嵌入 dist/ ====================

#[cfg(not(debug_assertions))]
mod embedded {
    use super::*;
    use rust_embed::Embed;

    #[derive(Embed)]
    #[folder = "../dist/"]
    pub struct SpaAssets;

    pub async fn serve_embedded_file(path: &str) -> Response<Body> {
        let path = if path.is_empty() { "index.html" } else { path };

        match SpaAssets::get(path) {
            Some(file) => {
                let mime = mime_guess::from_path(path)
                    .first_or_octet_stream()
                    .to_string();
                Response::builder()
                    .status(StatusCode::OK)
                    .header(header::CONTENT_TYPE, HeaderValue::from_str(&mime).unwrap())
                    .header(header::CACHE_CONTROL, "public, max-age=31536000, immutable")
                    .body(Body::from(file.data.to_vec()))
                    .unwrap()
            }
            None => serve_index_html().await,
        }
    }

    pub async fn serve_index_html() -> Response<Body> {
        match SpaAssets::get("index.html") {
            Some(file) => Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
                .header(header::CACHE_CONTROL, "no-cache")
                .body(Body::from(file.data.to_vec()))
                .unwrap(),
            None => Response::builder()
                .status(StatusCode::NOT_FOUND)
                .header(header::CONTENT_TYPE, "text/plain")
                .body(Body::from("SPA not built"))
                .unwrap(),
        }
    }
}

// ==================== Debug 模式：代理到 Vite Dev Server ====================

#[cfg(debug_assertions)]
mod proxy {
    use super::*;

    const VITE_DEV_URL: &str = "http://localhost:5173";

    async fn proxy_request(url: &str) -> Response<Body> {
        let client = reqwest::Client::new();
        match client.get(url).send().await {
            Ok(resp) => {
                let status = StatusCode::from_u16(resp.status().as_u16())
                    .unwrap_or(StatusCode::BAD_GATEWAY);
                let content_type = resp
                    .headers()
                    .get(reqwest::header::CONTENT_TYPE)
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("application/octet-stream")
                    .to_string();
                let bytes = resp.bytes().await.unwrap_or_default();

                Response::builder()
                    .status(status)
                    .header(header::CONTENT_TYPE, content_type)
                    .header(header::CACHE_CONTROL, "no-cache")
                    .body(Body::from(bytes))
                    .unwrap()
            }
            Err(_) => Response::builder()
                .status(StatusCode::BAD_GATEWAY)
                .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
                .body(Body::from(
                    "Vite dev server not running. Start it with: npm run dev",
                ))
                .unwrap(),
        }
    }

    pub async fn serve_embedded_file(path: &str, query: Option<&str>) -> Response<Body> {
        let url = match query {
            Some(q) if !q.is_empty() => format!("{}/{}?{}", VITE_DEV_URL, path, q),
            _ => format!("{}/{}", VITE_DEV_URL, path),
        };
        proxy_request(&url).await
    }

    pub async fn serve_index_html() -> Response<Body> {
        let url = format!("{}/", VITE_DEV_URL);
        proxy_request(&url).await
    }
}

// ==================== 公共接口 ====================

pub async fn serve_embedded_file(path: &str, _query: Option<&str>) -> Response<Body> {
    #[cfg(not(debug_assertions))]
    { embedded::serve_embedded_file(path).await }
    #[cfg(debug_assertions)]
    { proxy::serve_embedded_file(path, _query).await }
}

pub async fn serve_index_html() -> Response<Body> {
    #[cfg(not(debug_assertions))]
    { embedded::serve_index_html().await }
    #[cfg(debug_assertions)]
    { proxy::serve_index_html().await }
}
