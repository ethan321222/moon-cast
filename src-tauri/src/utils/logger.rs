use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

use chrono::Local;

static LOGGER: Mutex<Option<PathBuf>> = Mutex::new(None);

/// 初始化日志模块，传入 app_data_dir。
/// 创建 logs 目录，清理 7 天前的日志文件。
pub fn init(app_data_dir: &PathBuf) {
    let log_dir = app_data_dir.join("logs");
    fs::create_dir_all(&log_dir).ok();

    // 清理 7 天前的日志
    clean_old_logs(&log_dir);

    let mut guard = LOGGER.lock().unwrap();
    *guard = Some(log_dir);
}

/// 写入日志。
///
/// # 用法
/// ```rust
/// logger::log("MoonCast 启动");
/// logger::log(&format!("[IPC] start_server, port: {}", config.port));
/// ```
pub fn log(message: &str) {
    info_inner(message);
}

fn info_inner(message: &str) {
    let guard = LOGGER.lock().unwrap();
    let log_dir = match guard.as_ref() {
        Some(dir) => dir.clone(),
        None => {
            eprintln!("[logger] 未初始化: {}", message);
            return;
        }
    };
    drop(guard);

    let now = Local::now();
    let filename = format!("{}.log", now.format("%Y-%m-%d"));
    let filepath = log_dir.join(filename);
    let line = format!("[{}] {}\n", now.format("%H:%M:%S"), message);

    match OpenOptions::new().create(true).append(true).open(&filepath) {
        Ok(mut file) => {
            let _ = file.write_all(line.as_bytes());
        }
        Err(e) => {
            eprintln!("[logger] 写入失败 {}: {}", filepath.display(), e);
        }
    }
}

/// 删除 7 天前的 .log 文件。
fn clean_old_logs(log_dir: &PathBuf) {
    let cutoff = Local::now() - chrono::Duration::days(7);

    let entries = match fs::read_dir(log_dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let name = entry.file_name();
        let name_str = name.to_string_lossy();

        // 解析文件名 YYYY-MM-DD.log
        if let Some(date_str) = name_str.strip_suffix(".log") {
            if let Ok(date) = chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
                if date < cutoff.naive_local().date() {
                    let _ = fs::remove_file(entry.path());
                }
            }
        }
    }
}
