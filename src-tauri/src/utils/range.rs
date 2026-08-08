use axum::body::Body;
use axum::http::{header, HeaderMap, Response, StatusCode};
use std::path::Path;
use tokio::fs::File;
use tokio::io::{AsyncRead, AsyncReadExt, AsyncSeekExt};
use tokio_util::io::ReaderStream;

use crate::utils::throttle::ThrottledRead;

fn stream_body<R: AsyncRead + Send + Unpin + 'static>(
    reader: R,
    speed_limit: Option<u64>,
) -> Body {
    match speed_limit {
        Some(limit) => {
            let throttled = ThrottledRead::new(reader, limit);
            Body::from_stream(ReaderStream::new(throttled))
        }
        None => Body::from_stream(ReaderStream::new(reader)),
    }
}

pub struct RangeSpec {
    pub start: u64,
    pub end: u64,
}

pub fn parse_range(range_header: &str, file_size: u64) -> Option<RangeSpec> {
    let range_str = range_header.strip_prefix("bytes=")?;
    let parts: Vec<&str> = range_str.splitn(2, '-').collect();
    if parts.len() != 2 {
        return None;
    }

    let start_str = parts[0].trim();
    let end_str = parts[1].trim();

    if start_str.is_empty() {
        // 后缀范围：-500 表示最后 500 字节
        let suffix_len: u64 = end_str.parse().ok()?;
        if suffix_len == 0 || suffix_len > file_size {
            return None;
        }
        Some(RangeSpec {
            start: file_size - suffix_len,
            end: file_size - 1,
        })
    } else {
        let start: u64 = start_str.parse().ok()?;
        let end = if end_str.is_empty() {
            file_size - 1
        } else {
            end_str.parse().ok()?
        };

        if start > end || start >= file_size {
            return None;
        }

        let end = end.min(file_size - 1);
        Some(RangeSpec { start, end })
    }
}

pub async fn build_range_response(
    path: &Path,
    headers: &HeaderMap,
    content_type: &str,
    speed_limit: Option<u64>,
) -> Result<Response<Body>, std::io::Error> {
    let metadata = tokio::fs::metadata(path).await?;
    let file_size = metadata.len();

    let range_header = headers
        .get(header::RANGE)
        .and_then(|v| v.to_str().ok());

    if let Some(range_str) = range_header {
        if let Some(range) = parse_range(range_str, file_size) {
            let content_length = range.end - range.start + 1;

            let mut file = File::open(path).await?;
            file.seek(std::io::SeekFrom::Start(range.start)).await?;
            let limited = file.take(content_length);
            let body = stream_body(limited, speed_limit);

            let response = Response::builder()
                .status(StatusCode::PARTIAL_CONTENT)
                .header(header::CONTENT_TYPE, content_type)
                .header(header::CONTENT_LENGTH, content_length)
                .header(header::ACCEPT_RANGES, "bytes")
                .header(
                    header::CONTENT_RANGE,
                    format!("bytes {}-{}/{}", range.start, range.end, file_size),
                )
                .body(body)
                .expect("valid 206 response");

            Ok(response)
        } else {
            // 无效范围 - 416
            let response = Response::builder()
                .status(StatusCode::RANGE_NOT_SATISFIABLE)
                .header(header::CONTENT_RANGE, format!("bytes */{}", file_size))
                .body(Body::empty())
                .expect("valid 416 response");
            Ok(response)
        }
    } else {
        // 无 Range 头 - 完整文件
        let file = File::open(path).await?;
        let body = stream_body(file, speed_limit);

        let response = Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, content_type)
            .header(header::CONTENT_LENGTH, file_size)
            .header(header::ACCEPT_RANGES, "bytes")
            .body(body)
            .expect("valid 200 response");

        Ok(response)
    }
}
