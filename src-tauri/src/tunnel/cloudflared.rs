use std::path::PathBuf;
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::watch;

use super::{TunnelHandle, TunnelKind};

/// 启动 cloudflared Quick Tunnel。
/// 返回 TunnelHandle，其中 public_url 在解析到后填充。
pub async fn start(binary: &PathBuf, port: u16) -> Result<TunnelHandle, String> {
    let url_arg = format!("http://localhost:{}", port);

    let mut cmd = Command::new(binary);
    cmd.args(["tunnel", "--url", &url_arg])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);

    // Windows: 避免分配新控制台窗口
    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let mut child = cmd.spawn()
        .map_err(|e| format!("Failed to spawn cloudflared: {}", e))?;

    // cloudflared 将公网 URL 输出到 stderr
    let stderr = child.stderr.take()
        .ok_or("Failed to capture cloudflared stderr")?;

    let (url_tx, mut url_rx) = watch::channel::<Option<String>>(None);

    // 后台任务：读取 stderr 解析 URL + 监控进程退出
    let watcher = tokio::spawn(async move {
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();

        while let Ok(Some(line)) = lines.next_line().await {
            // cloudflared 输出类似：
            // ... | https://xxx-xxx-xxx.trycloudflare.com |
            // 或 INF +---..--- ... https://xxx.trycloudflare.com
            if let Some(url) = extract_tunnel_url(&line) {
                let _ = url_tx.send(Some(url));
            }
        }
    });

    // 等待最多 15 秒获取 URL
    let public_url = tokio::time::timeout(
        std::time::Duration::from_secs(15),
        async {
            loop {
                url_rx.changed().await.ok()?;
                let val = url_rx.borrow().clone();
                if val.is_some() {
                    return val;
                }
            }
        }
    )
    .await
    .unwrap_or(None);

    Ok(TunnelHandle::new(child, public_url, TunnelKind::Cloudflare, watcher))
}

/// 从 cloudflared 输出行中提取隧道 URL。
fn extract_tunnel_url(line: &str) -> Option<String> {
    // 匹配 https://xxx.trycloudflare.com 或任意 https:// URL
    let patterns = ["https://", "http://"];
    for pattern in patterns {
        if let Some(start) = line.find(pattern) {
            let rest = &line[start..];
            // URL 结束于空格、| 或行尾
            let end = rest.find(|c: char| c.is_whitespace() || c == '|')
                .unwrap_or(rest.len());
            let url = rest[..end].trim_end_matches('/').to_string();
            if url.contains(".trycloudflare.com") || url.contains("cfargotunnel.com") {
                return Some(url);
            }
        }
    }
    None
}

/// 获取 cloudflared 配置文件路径。
pub fn config_path(app_data_dir: &PathBuf) -> PathBuf {
    app_data_dir.join("cloudflared.yml")
}

/// 确保配置文件存在，不存在则创建默认模板。
pub fn ensure_config_file(app_data_dir: &PathBuf) -> Result<PathBuf, String> {
    let path = config_path(app_data_dir);
    if !path.exists() {
        let default_content = r#"# MoonCast Cloudflare Tunnel 配置文件
# 取消注释并填写你的配置以使用 Named Tunnel（固定域名）
# 参考文档: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/

# tunnel: <your-tunnel-id>
# credentials-file: <path-to-credentials.json>

# ingress:
#   - hostname: your-domain.com
#     service: http://localhost:8080
#   - service: http_status:404
"#;
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create config directory: {}", e))?;
        }
        std::fs::write(&path, default_content)
            .map_err(|e| format!("Failed to write config file: {}", e))?;
    }
    Ok(path)
}
