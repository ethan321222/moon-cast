use std::path::Path;
use tokio::io::AsyncWriteExt;

/// 通用文件下载，支持断点续传。
///
/// 文件布局：
///   dest       — 最终可执行文件（下载完成后改名）
///   dest.temp  — 下载中的内容
///   dest.meta  — 存储 ETag，用于校验续传是否有效
pub async fn download_file(url: &str, dest: &Path) -> Result<(), String> {
    let tmp = dest.with_extension("temp");
    let meta = dest.with_extension("meta");

    // meta 不存在 → 不允许续传，清理残留
    if !meta.exists() && tmp.exists() {
        eprintln!("[download] meta missing, cleaning leftover temp file");
        let _ = std::fs::remove_file(&tmp);
    }

    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(10))
        // TODO(security): Remove these before public release. This downloads an
        // executable binary, so disabling TLS certificate/hostname validation
        // makes MITM replacement possible. `--version` only proves the file can
        // run; it does not prove authenticity. Prefer pinned versions plus
        // checksum/signature verification, and make mirror use explicit opt-in.
        .danger_accept_invalid_certs(true)
        .danger_accept_invalid_hostnames(true)
        .connect_timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("ERR_HTTP_CLIENT:{}", e))?;

    // 循环处理重试（ETag 不匹配、416 等场景会清空重来）
    loop {
        // 读取已保存的 ETag 和已下载大小
        let saved_etag = if meta.exists() {
            std::fs::read_to_string(&meta).ok().map(|s| s.trim().to_string())
        } else {
            None
        };
        let existing_size = if tmp.exists() && saved_etag.is_some() {
            std::fs::metadata(&tmp).map(|m| m.len()).unwrap_or(0)
        } else {
            0
        };

        eprintln!("[download] starting: {}, existing: {} bytes, etag: {:?}", url, existing_size, saved_etag);

        // 续传前先 HEAD 校验 ETag
        if existing_size > 0 {
            if let Some(ref etag) = saved_etag {
                eprintln!("[download] HEAD checking ETag...");
                match client.head(url).send().await {
                    Ok(head_resp) => {
                        let remote_etag = head_resp.headers()
                            .get("etag")
                            .and_then(|v| v.to_str().ok())
                            .map(|s| s.to_string());

                        eprintln!("[download] remote ETag: {:?}, local ETag: {:?}", remote_etag, etag);

                        if remote_etag.as_deref() != Some(etag.as_str()) {
                            eprintln!("[download] ETag mismatch, restarting download");
                            let _ = std::fs::remove_file(&tmp);
                            let _ = std::fs::remove_file(&meta);
                            continue; // 清空后重试
                        }
                        eprintln!("[download] ETag matched, resuming");
                    }
                    Err(e) => {
                        eprintln!("[download] HEAD request failed: {}, restarting download", e);
                        let _ = std::fs::remove_file(&tmp);
                        let _ = std::fs::remove_file(&meta);
                        continue; // 清空后重试
                    }
                }
            }
        }

        let mut req = client.get(url);

        // 断点续传：已有部分数据则加 Range 头
        if existing_size > 0 {
            req = req.header("Range", format!("bytes={}-", existing_size));
            eprintln!("[download] requesting Range: bytes={}-", existing_size);
        }

        let response = req.send().await.map_err(|e| {
            eprintln!("[download] request failed: {}", e);
            format!("ERR_REQUEST_FAILED:{}", e)
        })?;

        let status = response.status();
        let final_url = response.url().to_string();

        // 提取 ETag 并保存
        let remote_etag = response.headers()
            .get("etag")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());

        if let Some(ref etag) = remote_etag {
            eprintln!("[download] saving ETag: {}", etag);
            let _ = std::fs::write(&meta, etag);
        }

        eprintln!("[download] response status: {}, final URL: {}", status, final_url);

        // 416 = Range 不满足，清空重来
        if status == reqwest::StatusCode::RANGE_NOT_SATISFIABLE {
            eprintln!("[download] Range not satisfiable, deleting temp and restarting");
            let _ = std::fs::remove_file(&tmp);
            let _ = std::fs::remove_file(&meta);
            continue;
        }

        // 非 200/206 都算失败
        if !status.is_success() && status != reqwest::StatusCode::PARTIAL_CONTENT {
            let body = response.text().await.unwrap_or_default();
            eprintln!("[download] response body: {}", body);
            return Err(format!("ERR_HTTP_ERROR:{} {} {}", status, status.canonical_reason().unwrap_or("unknown"), final_url));
        }

        // 追加写入或新建
        let mut file = if status == reqwest::StatusCode::PARTIAL_CONTENT && existing_size > 0 {
            eprintln!("[download] append mode");
            tokio::fs::OpenOptions::new()
                .append(true)
                .open(&tmp)
                .await
                .map_err(|e| format!("ERR_OPEN_FILE:{}", e))?
        } else {
            eprintln!("[download] fresh download");
            tokio::fs::File::create(&tmp)
                .await
                .map_err(|e| format!("ERR_CREATE_FILE:{}", e))?
        };

        let mut stream = response.bytes_stream();
        let mut total = if status == reqwest::StatusCode::PARTIAL_CONTENT { existing_size } else { 0 };

        while let Some(chunk) = futures_util::StreamExt::next(&mut stream).await {
            let chunk = chunk.map_err(|e| format!("ERR_READ_DATA:{}", e))?;
            file.write_all(&chunk).await.map_err(|e| format!("ERR_WRITE_DATA:{}", e))?;
            total += chunk.len() as u64;
        }

        file.flush().await.map_err(|e| format!("ERR_FLUSH:{}", e))?;
        drop(file);

        eprintln!("[download] completed, total: {} bytes", total);

        // 改名到目标路径
        std::fs::rename(&tmp, dest).map_err(|e| {
            eprintln!("[download] rename failed: {} -> {:?}: {}", tmp.display(), dest, e);
            format!("ERR_RENAME:{}", e)
        })?;

        // 下载成功，清理 meta
        let _ = std::fs::remove_file(&meta);

        return Ok(());
    }
}

/// 设置文件为可执行（Unix chmod 755，Windows 解除 Zone.Identifier 锁定）。
pub fn set_executable(path: &Path) -> Result<(), String> {
    #[cfg(not(target_os = "windows"))]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(path)
            .map_err(|e| e.to_string())?
            .permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(path, perms)
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        // 移除 Zone.Identifier，解除 Windows SmartScreen 阻止
        let zone_path = format!("{}:Zone.Identifier", path.display());
        let _ = std::fs::remove_file(&zone_path);
    }
    Ok(())
}

/// 返回当前平台信息：(os, arch, ext)。
pub fn platform_info() -> (&'static str, &'static str, &'static str) {
    let os = if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "darwin"
    } else {
        "linux"
    };

    let arch = if cfg!(target_arch = "x86_64") {
        "amd64"
    } else if cfg!(target_arch = "aarch64") {
        "arm64"} else {
        "amd64"
    };

    let ext = if cfg!(target_os = "windows") { ".exe" } else { "" };

    (os, arch, ext)
}
