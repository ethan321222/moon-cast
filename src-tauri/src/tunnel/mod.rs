pub mod cloudflared;
pub mod installer;

use serde::Serialize;
use tokio::process::Child;

/// 隧道类型，后续可扩展 Frp / Ngrok 等。
#[derive(Debug, Clone, Copy, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TunnelKind {
    Cloudflare,
}

/// 隧道运行状态，用于 IPC 返回给前端。
#[derive(Debug, Clone, Serialize)]
pub struct TunnelStatus {
    pub running: bool,
    pub public_url: Option<String>,
    pub kind: TunnelKind,
}

/// 隧道运行句柄，持有子进程和元数据。
pub struct TunnelHandle {
    child: Child,
    pub public_url: Option<String>,
    pub kind: TunnelKind,
    /// 后台 watcher 用于检测进程异常退出。
    _watcher: tokio::task::JoinHandle<()>,
}

impl TunnelHandle {
    pub fn new(
        child: Child,
        public_url: Option<String>,
        kind: TunnelKind,
        watcher: tokio::task::JoinHandle<()>,
    ) -> Self {
        Self {
            child,
            public_url,
            kind,
            _watcher: watcher,
        }
    }

    /// 停止隧道进程。
    pub async fn stop(mut self) {
        let _ = self.child.kill().await;
        let _ = self.child.wait().await;
        self._watcher.abort();
    }

    /// 获取当前状态快照。
    pub fn status(&self) -> TunnelStatus {
        TunnelStatus {
            running: true,
            public_url: self.public_url.clone(),
            kind: self.kind,
        }
    }
}
