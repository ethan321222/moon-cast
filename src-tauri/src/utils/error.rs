use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::response::Response;

#[derive(Debug)]
pub enum AppError {
    NotFound(String),
    Forbidden(String),
    BadRequest(String),
    Conflict(String),
    Internal(String),
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AppError::NotFound(msg) => write!(f, "Not Found: {}", msg),
            AppError::Forbidden(msg) => write!(f, "Forbidden: {}", msg),
            AppError::BadRequest(msg) => write!(f, "Bad Request: {}", msg),
            AppError::Conflict(msg) => write!(f, "Conflict: {}", msg),
            AppError::Internal(msg) => write!(f, "Internal Error: {}", msg),
        }
    }
}

impl AppError {
    fn status_and_message(&self) -> (StatusCode, &str, &str) {
        match self {
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, "Not Found", msg),
            AppError::Forbidden(msg) => (StatusCode::FORBIDDEN, "Forbidden", msg),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, "Bad Request", msg),
            AppError::Conflict(msg) => (StatusCode::CONFLICT, "Conflict", msg),
            AppError::Internal(msg) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal Server Error",
                msg,
            ),
        }
    }

    /// 返回 JSON 错误响应（React 前端统一处理错误显示）。
    pub fn into_response_for(self, _headers: &HeaderMap) -> Response {
        let (status, _title, message) = self.status_and_message();
        let body = serde_json::json!({ "error": message });
        (status, axum::Json(body)).into_response()
    }
}

/// 默认 IntoResponse：返回 JSON。
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, _title, message) = self.status_and_message();
        let body = serde_json::json!({ "error": message });
        (status, axum::Json(body)).into_response()
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        match err.kind() {
            std::io::ErrorKind::NotFound => AppError::NotFound(err.to_string()),
            std::io::ErrorKind::PermissionDenied => AppError::Forbidden(err.to_string()),
            _ => AppError::Internal(err.to_string()),
        }
    }
}
