use axum::body::Body;
use axum::extract::ConnectInfo;
use axum::http::Request;
use axum::middleware::Next;
use axum::response::Response;
use chrono::Local;
use std::net::SocketAddr;

#[derive(Clone)]
pub enum LogTarget {
    Stdout,
    Off,
    Channel(tokio::sync::broadcast::Sender<String>),
}

impl LogTarget {
    pub fn stdout() -> Self {
        LogTarget::Stdout
    }

    pub fn off() -> Self {
        LogTarget::Off
    }

    pub fn channel(capacity: usize) -> (Self, tokio::sync::broadcast::Receiver<String>) {
        let (tx, rx) = tokio::sync::broadcast::channel(capacity);
        (LogTarget::Channel(tx), rx)
    }
}

pub async fn access_log(
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    log_target: axum::extract::State<LogTarget>,
    request: Request<Body>,
    next: Next,
) -> Response {
    let method = request.method().clone();
    let uri = request.uri().clone();
    let is_xhr = request
        .headers()
        .get("X-Requested-With")
        .and_then(|v| v.to_str().ok())
        .map(|v| v == "XMLHttpRequest")
        .unwrap_or(false);
    let start = std::time::Instant::now();

    let response = next.run(request).await;

    let status = response.status().as_u16();
    let elapsed = start.elapsed();
    let elapsed_ms = elapsed.as_secs_f64() * 1000.0;
    let now = Local::now().format("%Y-%m-%d %H:%M:%S");
    let kind = if is_xhr { 'A' } else { 'P' };

    let line = format!(
        "[{}] {} {} {} {} {} {:.1}ms",
        now,
        addr.ip(),
        method,
        kind,
        uri,
        status,
        elapsed_ms,
    );

    match &log_target.0 {
        LogTarget::Stdout => {
            println!("{}", line);
        }
        LogTarget::Off => {}
        LogTarget::Channel(tx) => {
            let _ = tx.send(line);
        }
    }

    response
}
