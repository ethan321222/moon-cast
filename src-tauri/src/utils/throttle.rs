use std::future::Future;
use std::pin::Pin;
use std::task::{Context, Poll};
use std::time::Instant;
use tokio::io::AsyncRead;
use tokio::io::ReadBuf;

/// 包装 AsyncRead 以限制吞吐量为 bytes_per_sec。
/// 使用令牌桶方法：令牌（字节）随时间累积，最多累积到 bytes_per_sec（一秒的量）。
pub struct ThrottledRead<R> {
    inner: R,
    bytes_per_sec: f64,
    tokens: f64,
    last_refill: Instant,
    sleep: Pin<Box<tokio::time::Sleep>>,
    sleeping: bool,
}

impl<R: AsyncRead + Unpin> ThrottledRead<R> {
    pub fn new(inner: R, bytes_per_sec: u64) -> Self {
        Self {
            inner,
            bytes_per_sec: bytes_per_sec as f64,
            tokens: bytes_per_sec as f64,
            last_refill: Instant::now(),
            sleep: Box::pin(tokio::time::sleep(tokio::time::Duration::ZERO)),
            sleeping: false,
        }
    }

    fn refill_tokens(&mut self) {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_refill).as_secs_f64();
        self.last_refill = now;
        self.tokens += elapsed * self.bytes_per_sec;
        if self.tokens > self.bytes_per_sec {
            self.tokens = self.bytes_per_sec;
        }
    }
}

impl<R: AsyncRead + Unpin> AsyncRead for ThrottledRead<R> {
    fn poll_read(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut ReadBuf<'_>,
    ) -> Poll<std::io::Result<()>> {
        let this = self.get_mut();

        if this.sleeping {
            match this.sleep.as_mut().poll(cx) {
                Poll::Ready(()) => {
                    this.sleeping = false;
                    this.refill_tokens();
                }
                Poll::Pending => return Poll::Pending,
            }
        }

        this.refill_tokens();

        if this.tokens < 1.0 {
            let wait_secs = (1.0 - this.tokens) / this.bytes_per_sec;
            let wait = std::time::Duration::from_secs_f64(wait_secs);
            this.sleep
                .as_mut()
                .reset(tokio::time::Instant::now() + wait);
            this.sleeping = true;
            match this.sleep.as_mut().poll(cx) {
                Poll::Ready(()) => {
                    this.sleeping = false;
                    this.refill_tokens();
                }
                Poll::Pending => return Poll::Pending,
            }
        }

        let allowed = this.tokens as usize;
        let remaining = buf.remaining();
        let limit = remaining.min(allowed);

        let filled_before = buf.filled().len();
        if limit < remaining {
            let mut limited_buf = ReadBuf::new(&mut buf.initialize_unfilled()[..limit]);
            match Pin::new(&mut this.inner).poll_read(cx, &mut limited_buf) {
                Poll::Ready(Ok(())) => {
                    let bytes_read = limited_buf.filled().len();
                    buf.advance(bytes_read);
                    this.tokens -= bytes_read as f64;
                    Poll::Ready(Ok(()))
                }
                other => other,
            }
        } else {
            match Pin::new(&mut this.inner).poll_read(cx, buf) {
                Poll::Ready(Ok(())) => {
                    let bytes_read = buf.filled().len() - filled_before;
                    this.tokens -= bytes_read as f64;
                    Poll::Ready(Ok(()))
                }
                other => other,
            }
        }
    }
}

/// 解析可读的速度字符串，如 "500k"、"1m"、"2g" 为 bytes/sec。
pub fn parse_speed(s: &str) -> Option<u64> {
    let s = s.trim();
    if s.is_empty() {
        return None;
    }

    let (num_str, multiplier) = match s.as_bytes().last()? {
        b'k' | b'K' => (&s[..s.len() - 1], 1024u64),
        b'm' | b'M' => (&s[..s.len() - 1], 1024 * 1024),
        b'g' | b'G' => (&s[..s.len() - 1], 1024 * 1024 * 1024),
        _ => (s, 1u64),
    };

    let num: f64 = num_str.parse().ok()?;
    if num <= 0.0 || !num.is_finite() {
        return None;
    }

    Some((num * multiplier as f64) as u64)
}
