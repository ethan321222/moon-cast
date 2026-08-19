pub mod config;
pub mod directory;
pub mod handlers;
pub mod spa;

use axum::Router;
use axum::body::Body;
use axum::extract::{State, Path as AxumPath};
use axum::http::{Request, Response, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Json};
use axum::routing::{any, get, post};
use serde_json::json;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::oneshot;
use tower_http::cors::CorsLayer;

use config::ServerConfig;
use handlers::AppState;
use crate::utils::logging::{self, LogTarget};
use crate::utils::power::{self, PowerAction};
use crate::utils::webdav::{WebDav, WebDavConfig};

/// 优雅关闭的宽限期。超时后强制中止。
const SHUTDOWN_GRACE: Duration = Duration::from_secs(3);

/// 服务器启动失败错误。
#[derive(Debug)]
pub enum StartError {
    Bind(std::io::Error),
}

impl std::fmt::Display for StartError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StartError::Bind(e) => write!(f, "failed to bind listener: {}", e),
        }
    }
}

impl std::error::Error for StartError {}

/// 运行中的服务器句柄。丢弃不会停止服务器。
pub struct ServerHandle {
    shutdown: Option<oneshot::Sender<()>>,
    join: tokio::task::JoinHandle<()>,
    pub local_addr: SocketAddr,
}

impl ServerHandle {
    /// 优雅关闭，等待最多 SHUTDOWN_GRACE。
    pub async fn stop(mut self) {
        if let Some(tx) = self.shutdown.take() {
            let _ = tx.send(());
        }
        match tokio::time::timeout(SHUTDOWN_GRACE, &mut self.join).await {
            Ok(_) => {}
            Err(_) => {
                self.join.abort();
                let _ = (&mut self.join).await;
            }
        }
    }

    /// 立即中止，不等待。可从 UI 线程安全调用。
    pub fn abort(mut self) {
        if let Some(tx) = self.shutdown.take() {
            let _ = tx.send(());
        }
        self.join.abort();
    }

    /// 阻塞直到服务器任务完成。
    pub async fn wait(self) {
        let _ = self.join.await;
    }
}

/// 注入 DAV 头的中间件。
async fn dav_headers_middleware(request: Request<Body>, next: Next) -> Response<Body> {
    let mut response = next.run(request).await;
    let headers = response.headers_mut();
    headers.insert("DAV", "1, 2".parse().expect("valid header"));
    if !headers.contains_key("Allow") {
        headers.insert(
            "Allow",
            "OPTIONS, GET, HEAD, PUT, DELETE, MKCOL, COPY, MOVE, PROPFIND, PROPPATCH, LOCK, UNLOCK"
                .parse()
                .expect("valid header"),
        );
    }
    response
}

/// 统一认证中间件：当 auth_enabled 且设置了 auth_user 时，所有请求均需 Basic Auth。
pub async fn auth_middleware(
    State(state): State<Arc<AppState>>,
    request: Request<Body>,
    next: Next,
) -> Response<Body> {
    if state.auth_enabled {
        let expected_user = state.auth_user.as_deref().map(str::trim);
        let expected_pass = state.auth_pass.as_deref().map(str::trim);
        if let (Some(expected_user), Some(expected_pass)) = (expected_user, expected_pass) {
            if expected_user.is_empty() || expected_pass.is_empty() {
                return unauthorized_response();
            }
            let authorized = request
                .headers()
                .get(axum::http::header::AUTHORIZATION)
                .and_then(|v| v.to_str().ok())
                .and_then(|val| {
                    if val.starts_with("Basic ") {
                        crate::utils::encoding::base64_decode(&val[6..])
                    } else {
                        None
                    }
                })
                .map(|decoded| {
                    decoded.split_once(':')
                        .map(|(u, p)| u == expected_user && p == expected_pass)
                        .unwrap_or(false)
                })
                .unwrap_or(false);

            if !authorized {
                return unauthorized_response();
            }
        } else {
            return unauthorized_response();
        }
    }
    next.run(request).await
}

fn unauthorized_response() -> Response<Body> {
    Response::builder()
        .status(axum::http::StatusCode::UNAUTHORIZED)
        .header("WWW-Authenticate", "Basic realm=\"moon-cast\"")
        .header(axum::http::header::CONTENT_LENGTH, "0")
        .body(Body::empty())
        .expect("building 401 response")
}

/// 电源控制 handler：POST /utils/power/:action
async fn handle_power(
    axum::extract::State(log_target): axum::extract::State<LogTarget>,
    AxumPath(action): AxumPath<String>,
) -> Response<Body> {
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S");
    match PowerAction::from_str(&action) {
        Some(power_action) => match power::execute(power_action) {
            Ok(()) => {
                let line = format!("[{}] [Power] executed: {}", now, action);
                match &log_target {
                    LogTarget::Stdout => println!("{}", line),
                    LogTarget::Off => {}
                    LogTarget::Channel(tx) => { let _ = tx.send(line); }
                }
                Json(json!({ "ok": true })).into_response()
            }
            Err(e) => {
                let line = format!("[{}] [Power] failed: {} - {}", now, action, e);
                match &log_target {
                    LogTarget::Stdout => eprintln!("{}", line),
                    LogTarget::Off => {}
                    LogTarget::Channel(tx) => { let _ = tx.send(line); }
                }
                Response::builder()
                    .status(StatusCode::INTERNAL_SERVER_ERROR)
                    .header("content-type", "application/json")
                    .body(Body::from(json!({ "error": e }).to_string()))
                    .expect("building error response")
            }
        },
        None => {
            let line = format!("[{}] [Power] unknown action: {}", now, action);
            match &log_target {
                LogTarget::Stdout => eprintln!("{}", line),
                LogTarget::Off => {}
                LogTarget::Channel(tx) => { let _ = tx.send(line); }
            }
            Response::builder()
                .status(StatusCode::BAD_REQUEST)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({ "error": format!("unknown action: {}", action) }).to_string(),
                ))
                .expect("building 400 response")
        }
    }
}

/// 组装 Axum 路由器，应用所有中间件层。
pub fn build_router(state: Arc<AppState>, log_target: LogTarget) -> Router {
    let webdav_enabled = state.webdav;
    let auth_state = state.clone();

    // 电源控制子路由，使用 LogTarget 作为 state
    let power_router = Router::new()
        .route("/utils/power/{action}", post(handle_power))
        .with_state(log_target.clone());

    let mut app = Router::new()
        .merge(power_router)
        .route("/", get(handlers::serve_index))
        .route("/{*path}", get(handlers::serve_path));

    if webdav_enabled {
        let has_auth_credentials = state.auth_enabled
            && state
                .auth_user
                .as_deref()
                .map(str::trim)
                .is_some_and(|value| !value.is_empty())
            && state
                .auth_pass
                .as_deref()
                .map(str::trim)
                .is_some_and(|value| !value.is_empty());
        let webdav_auth_user = if has_auth_credentials {
            state.auth_user.clone()
        } else {
            None
        };
        let webdav_auth_pass = if has_auth_credentials {
            state.auth_pass.clone()
        } else {
            None
        };
        let dav = WebDav::new(WebDavConfig {
            root: state.root.clone(),
            show_hidden: state.show_hidden,
            max_depth: state.max_depth,
            auth_user: webdav_auth_user,
            auth_pass: webdav_auth_pass,
            read_only: !has_auth_credentials,
        });

        let dav_root = dav.clone();
        let dav_path = dav;

        app = app
            .route("/", any(move |method, headers, body| {
                let dav = dav_root.clone();
                async move { dav.handle_root(method, headers, body).await }
            }))
            .route("/{*path}", any(move |method, path, headers, body| {
                let dav = dav_path.clone();
                async move { dav.handle_path(method, path, headers, body).await }
            }));
    }

    app.layer(axum::middleware::from_fn_with_state(
        log_target,
        logging::access_log,
    ))
    .layer(axum::middleware::from_fn_with_state(
        auth_state,
        auth_middleware,
    ))
    .layer(CorsLayer::permissive())
    .layer(axum::middleware::from_fn(dav_headers_middleware))
    .with_state(state)
}

/// 绑定监听器并启动服务器任务。
pub async fn run(config: ServerConfig, log_target: LogTarget) -> Result<ServerHandle, StartError> {
    // canonicalize root 以确保与 safe_resolve 中 canonicalize 后的路径前缀一致（Windows 需要）
    let root = std::fs::canonicalize(&config.root)
        .unwrap_or_else(|_| config.root.clone());

    let state = Arc::new(AppState {
        root,
        show_hidden: config.show_hidden,
        max_depth: config.max_depth,
        speed_limit: config.speed_limit,
        webdav: config.webdav,
        auth_enabled: config.auth_enabled,
        auth_user: config.auth_user,
        auth_pass: config.auth_pass,
    });

    let app = build_router(state, log_target);

    let listener = tokio::net::TcpListener::bind(format!("{}:{}", config.bind, config.port))
        .await
        .map_err(StartError::Bind)?;

    let local_addr = listener.local_addr().map_err(StartError::Bind)?;

    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

    let join = tokio::spawn(async move {
        let serve = axum::serve(
            listener,
            app.into_make_service_with_connect_info::<SocketAddr>(),
        )
        .with_graceful_shutdown(async move {
            let _ = shutdown_rx.await;
        });

        if let Err(e) = serve.await {
            eprintln!("Server error: {}", e);
        }
    });

    Ok(ServerHandle {
        shutdown: Some(shutdown_tx),
        join,
        local_addr,
    })
}
