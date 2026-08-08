use serde::Serialize;
use std::path::Path;

use crate::utils::error::AppError;
use crate::utils::fs::{self, FileEntry, SortOptions};
use crate::utils::path::{safe_resolve, path_depth};

#[derive(Serialize)]
pub struct DirListing {
    pub path: String,
    pub entries: Vec<FileEntry>,
}

/// 列出目录内容。
pub async fn list_directory(
    root: &Path,
    rel_path: &str,
    show_hidden: bool,
    max_depth: i32,
) -> Result<DirListing, AppError> {
    let full_path = safe_resolve(root, rel_path, show_hidden, max_depth).await?;

    if !full_path.is_dir() {
        return Err(AppError::BadRequest("Not a directory".into()));
    }

    let rel_path_owned = rel_path.to_string();
    tokio::task::spawn_blocking(move || {
        let normalized_rel: String = rel_path_owned
            .split('/')
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>()
            .join("/");

        let depth = path_depth(&normalized_rel);
        let sort = SortOptions::default();
        let entries = fs::list_dir(&full_path, &normalized_rel, show_hidden, max_depth, depth, &sort)?;

        let path = if normalized_rel.is_empty() {
            "/".to_string()
        } else {
            format!("/{}", normalized_rel)
        };

        Ok(DirListing { path, entries })
    })
    .await
    .map_err(|e| AppError::Internal(format!("Task join error: {}", e)))?
}
