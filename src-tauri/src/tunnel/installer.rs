use std::path::PathBuf;

use crate::utils::download::{download_file, platform_info, set_executable};

/// 确保 cloudflared 二进制文件可用，不存在或损坏则自动下载。
///
/// 流程：
/// 1. 检查目标路径是否已有有效二进制（大小 > 100KB + 可执行）
/// 2. 有效 → 直接返回路径
/// 3. 损坏 → 删除，进入下载流程
/// 4. 按优先级尝试下载源：GitHub → 代理镜像
/// 5. 每个源下载后都验证，验证失败则删除并尝试下一个
/// 6. 全部失败 → 返回错误，附带手动下载地址
///
/// 文件布局（下载过程中）：
///   bin/cloudflared.exe      — 最终可执行文件
///   bin/cloudflared.exe.temp — 下载中的内容（支持断点续传）
///   bin/cloudflared.exe.meta — 存储 ETag，用于校验续传有效性
pub async fn check_or_download(app_data_dir: &PathBuf) -> Result<PathBuf, DownloadError> {
    let bin_dir = app_data_dir.join("bin");
    let bin_path = bin_dir.join(binary_name());

    // ---- 1. 已有有效二进制，直接返回 ----
    if bin_path.exists() && is_valid_binary(&bin_path) {
        eprintln!("[installer] binary exists and valid: {:?}", bin_path);
        return Ok(bin_path);
    }

    // ---- 2. 文件存在但损坏，删除 ----
    if bin_path.exists() {
        eprintln!("[installer] binary corrupted, removing: {:?}", bin_path);
        let _ = std::fs::remove_file(&bin_path);
    }

    // ---- 3. 清理残留的临时文件（没有 meta 保护的 temp 文件不可信） ----
    let tmp = bin_path.with_extension("temp");
    let meta = bin_path.with_extension("meta");
    if tmp.exists() && !meta.exists() {
        eprintln!("[installer] temp exists without meta, cleaning: {:?}", tmp);
        let _ = std::fs::remove_file(&tmp);
    }

    // 确保目标目录存在
    std::fs::create_dir_all(&bin_dir)
        .map_err(|e| DownloadError::Io(format!("ERR_CREATE_DIR:{}", e)))?;

    let urls = download_urls();

    // ---- 4. 尝试 GitHub ----
    eprintln!("[installer] trying GitHub: {}", urls.github);
    match download_file(&urls.github, &bin_path).await {
        Ok(()) => {
            set_executable(&bin_path).map_err(DownloadError::Io)?;
            if is_valid_binary(&bin_path) {
                return Ok(bin_path);
            }
            eprintln!("[installer] GitHub download failed validation");
            let _ = std::fs::remove_file(&bin_path);
        }
        Err(e) => {
            eprintln!("[installer] GitHub failed: {}", e);
        }
    }

    // ---- 5. 尝试代理镜像 ----
    if let Some(mirror_url) = &urls.mirror {
        eprintln!("[installer] trying mirror: {}", mirror_url);
        match download_file(mirror_url, &bin_path).await {
            Ok(()) => {
                set_executable(&bin_path).map_err(DownloadError::Io)?;
                if is_valid_binary(&bin_path) {
                    return Ok(bin_path);
                }
                eprintln!("[installer] mirror download failed validation");
                let _ = std::fs::remove_file(&bin_path);
            }
            Err(e) => {
                eprintln!("[installer] mirror failed: {}", e);
            }
        }
    }

    // ---- 6. 全部失败 ----
    // 清理可能残留的临时文件
    let _ = std::fs::remove_file(&tmp);
    let _ = std::fs::remove_file(&meta);

    Err(DownloadError::AllFailed {
        download_url: urls.github,
        target_dir: bin_dir.to_string_lossy().to_string(),
    })
}

/// 验证二进制文件是否有效（大小 > 100KB 且可执行）。
fn is_valid_binary(path: &std::path::Path) -> bool {
    // 检查文件大小，cloudflared 至少几十 MB
    let size = match std::fs::metadata(path) {
        Ok(m) => m.len(),
        Err(_) => return false,
    };
    if size < 1024 * 100 {
        eprintln!("[installer] file too small: {} bytes, likely incomplete", size);
        return false;
    }

    // 试跑 --version
    match std::process::Command::new(path)
        .arg("--version")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
    {
        Ok(s) => s.success(),
        Err(e) => {
            eprintln!("[installer] cannot execute: {}", e);
            false
        }
    }
}

/// 下载错误类型。
#[derive(Debug)]
pub enum DownloadError {
    Io(String),
    AllFailed {
        download_url: String,
        target_dir: String,
    },
}

impl std::fmt::Display for DownloadError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DownloadError::Io(msg) => write!(f, "{}", msg),
            DownloadError::AllFailed { download_url, target_dir } => {
                write!(
                    f,
                    "ERR_ALL_DOWNLOAD_FAILED:url={},dir={}",
                    download_url, target_dir
                )
            }
        }
    }
}

struct DownloadUrls {
    github: String,
    mirror: Option<String>,
}

fn download_urls() -> DownloadUrls {
    let (os, arch, ext) = platform_info();
    let filename = format!("cloudflared-{}-{}{}", os, arch, ext);
    let github = format!(
        "https://github.com/cloudflare/cloudflared/releases/latest/download/{}",
        filename
    );
    // GitHub 代理镜像
    let mirror = Some(format!(
        "https://ghfast.top/https://github.com/cloudflare/cloudflared/releases/latest/download/{}",
        filename
    ));

    DownloadUrls { github, mirror }
}

fn binary_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "cloudflared.exe"
    } else {
        "cloudflared"
    }
}
