use crate::utils::error::AppError;
use std::path::{Path, PathBuf};

/// 获取系统桌面路径（跨平台）。
/// 回退顺序：桌面 → 用户主目录 → 当前目录
pub fn desktop_dir() -> PathBuf {
    dirs::desktop_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| PathBuf::from("."))
}

/// 为写操作（PUT、MKCOL）解析路径，目标可能尚不存在。
/// 验证：隐藏组件检查、深度检查、父目录存在且在根目录内。
pub async fn safe_resolve_parent(
    root: &Path,
    rel_path: &str,
    show_hidden: bool,
    max_depth: i32,
) -> Result<PathBuf, AppError> {
    let rel_path_owned = rel_path.trim_start_matches('/').to_string();

    if rel_path_owned.is_empty() {
        return Err(AppError::BadRequest("Cannot write to root".into()));
    }

    if !show_hidden && has_hidden_component(&rel_path_owned) {
        return Err(AppError::Forbidden("Access to hidden files is denied".into()));
    }

    let root = root.to_path_buf();
    let rel = rel_path_owned.clone();
    tokio::task::spawn_blocking(move || {
        let target = root.join(&rel);

        let parent = target
            .parent()
            .ok_or_else(|| AppError::BadRequest("Invalid path".into()))?;

        let canonical_parent =
            std::fs::canonicalize(parent).map_err(|_| {
                AppError::Conflict("Parent directory does not exist".into())
            })?;

        if !canonical_parent.starts_with(&root) {
            return Err(AppError::Forbidden("Path traversal denied".into()));
        }

        if max_depth >= 0 {
            let depth = path_depth(&rel);
            if depth > (max_depth as u32) + 1 {
                return Err(AppError::Forbidden(
                    "Maximum directory depth exceeded".into(),
                ));
            }
        }

        Ok(target)
    })
    .await
    .map_err(|e| AppError::Internal(format!("Task join error: {}", e)))?
}

/// 安全解析路径：规范化、验证路径遍历、检查隐藏文件、检查最大深度。
pub async fn safe_resolve(
    root: &Path,
    rel_path: &str,
    show_hidden: bool,
    max_depth: i32,
) -> Result<PathBuf, AppError> {
    let rel_path_owned = rel_path.trim_start_matches('/').to_string();

    if !show_hidden && !rel_path_owned.is_empty() && has_hidden_component(&rel_path_owned) {
        return Err(AppError::Forbidden("Access to hidden files is denied".into()));
    }

    let root = root.to_path_buf();
    let rel = rel_path_owned.clone();
    tokio::task::spawn_blocking(move || {
        let candidate = if rel.is_empty() {
            root.clone()
        } else {
            root.join(&rel)
        };

        let canonical = std::fs::canonicalize(&candidate)
            .map_err(|_| AppError::NotFound(format!("Path not found: {}", rel)))?;

        if !canonical.starts_with(&root) {
            return Err(AppError::Forbidden("Path traversal denied".into()));
        }

        if max_depth >= 0 {
            let depth = path_depth(&rel);
            if canonical.is_dir() && depth > max_depth as u32 {
                return Err(AppError::Forbidden(
                    "Maximum directory depth exceeded".into(),
                ));
            }
            if canonical.is_file() && depth > (max_depth as u32) + 1 {
                return Err(AppError::Forbidden(
                    "Maximum directory depth exceeded".into(),
                ));
            }
        }

        Ok(canonical)
    })
    .await
    .map_err(|e| AppError::Internal(format!("Task join error: {}", e)))?
}

/// 检查路径中是否有以 '.' 开头的组件。
pub fn has_hidden_component(rel_path: &str) -> bool {
    rel_path
        .split('/')
        .any(|component| component.starts_with('.'))
}

/// 计算相对路径的深度（非空段数）。
pub fn path_depth(rel_path: &str) -> u32 {
    if rel_path.is_empty() {
        return 0;
    }
    rel_path.split('/').filter(|s| !s.is_empty()).count() as u32
}

/// 格式化字节数为人类可读的大小。
pub fn format_size(bytes: u64) -> String {
    if bytes == 0 {
        return "-".to_string();
    }
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut unit_idx = 0;
    while size >= 1024.0 && unit_idx < UNITS.len() - 1 {
        size /= 1024.0;
        unit_idx += 1;
    }
    if unit_idx == 0 {
        format!("{} {}", bytes, UNITS[0])
    } else {
        format!("{:.1} {}", size, UNITS[unit_idx])
    }
}
