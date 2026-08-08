use chrono::{DateTime, Local};
use serde::Serialize;
use std::path::Path;

use crate::utils::error::AppError;
use crate::utils::mime;

/// 文件条目 — 只包含文件系统原始数据。
#[derive(Serialize, Clone)]
pub struct FileEntry {
    pub name: String,
    pub rel_path: String,
    pub is_dir: bool,
    pub size: u64,
    pub created_ts: i64,
    pub modified_ts: i64,
    pub media_type: String,
}

/// 排序字段。
#[derive(Clone, Copy)]
pub enum SortField {
    Name,
    Size,
    Created,
    Modified,
}

/// 排序方向。
#[derive(Clone, Copy)]
pub enum SortOrder {
    Asc,
    Desc,
}

/// 排序选项。
#[derive(Clone)]
pub struct SortOptions {
    pub field: SortField,
    pub order: SortOrder,
    pub dirs_first: bool,
}

impl Default for SortOptions {
    fn default() -> Self {
        Self {
            field: SortField::Name,
            order: SortOrder::Asc,
            dirs_first: true,
        }
    }
}

/// 列出目录内容，返回原始文件条目列表。
///
/// - 不做路径安全检查（调用方应先用 `safe_resolve` 验证）
/// - 不做 URL 编码或大小格式化（留给调用方/前端）
/// - 支持隐藏文件过滤、深度限制、灵活排序
///
/// # 参数
///
/// - `dir` — 要列举的目录的绝对路径（已通过安全验证）
/// - `parent_rel_path` — 当前目录相对于服务根目录的路径（如 `"photos/2024"`），
///   用于拼接每个条目的 `rel_path`。根目录传空字符串 `""`。
/// - `show_hidden` — 是否包含以 `.` 开头的隐藏文件/目录
/// - `max_depth` — 最大目录深度限制，`-1` 表示不限制。
///   超过深度的子目录会被过滤掉。
/// - `current_depth` — 当前目录已处于的深度（用于与 `max_depth` 比较）
/// - `sort` — 排序选项，控制排序字段、方向及目录是否优先
pub fn list_dir(
    dir: &Path,
    parent_rel_path: &str,
    show_hidden: bool,
    max_depth: i32,
    current_depth: u32,
    sort: &SortOptions,
) -> Result<Vec<FileEntry>, AppError> {
    let mut entries = Vec::new();
    let rd = std::fs::read_dir(dir).map_err(AppError::from)?;

    for entry in rd {
        let entry = entry.map_err(AppError::from)?;
        let metadata = entry.metadata().map_err(AppError::from)?;
        let name = entry.file_name().to_string_lossy().to_string();

        if !show_hidden && name.starts_with('.') {
            continue;
        }

        let is_dir = metadata.is_dir();

        // 目录深度限制
        if max_depth >= 0 && is_dir && current_depth >= max_depth as u32 {
            continue;
        }

        let size = if is_dir { 0 } else { metadata.len() };

        let created_ts = metadata
            .created()
            .ok()
            .map(|t| {
                let dt: DateTime<Local> = t.into();
                dt.timestamp()
            })
            .unwrap_or(0);

        let modified_ts = metadata
            .modified()
            .ok()
            .map(|t| {
                let dt: DateTime<Local> = t.into();
                dt.timestamp()
            })
            .unwrap_or(0);

        let media_type = if is_dir {
            "directory".to_string()
        } else {
            mime::detect_mime(&entry.path()).to_string()
        };

        let rel_path = if parent_rel_path.is_empty() {
            name.clone()
        } else {
            format!("{}/{}", parent_rel_path, name)
        };

        entries.push(FileEntry {
            name,
            rel_path,
            is_dir,
            size,
            created_ts,
            modified_ts,
            media_type,
        });
    }

    sort_entries(&mut entries, sort);
    Ok(entries)
}

fn sort_entries(entries: &mut Vec<FileEntry>, sort: &SortOptions) {
    entries.sort_by(|a, b| {
        // 目录优先
        if sort.dirs_first && a.is_dir != b.is_dir {
            return if a.is_dir {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Greater
            };
        }

        let cmp = match sort.field {
            SortField::Name => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
            SortField::Size => a.size.cmp(&b.size),
            SortField::Created => a.created_ts.cmp(&b.created_ts),
            SortField::Modified => a.modified_ts.cmp(&b.modified_ts),
        };

        match sort.order {
            SortOrder::Asc => cmp,
            SortOrder::Desc => cmp.reverse(),
        }
    });
}
