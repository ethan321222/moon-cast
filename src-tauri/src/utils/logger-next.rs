use chrono::Local;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};

/// 全局 Logger 实例
static GLOBAL_LOGGER: OnceLock<Logger> = OnceLock::new();

/// 初始化全局 Logger（与旧 API 兼容）。
/// 传入 app_data_dir，日志写入 app_data_dir/logs/ 目录。
pub fn init(app_data_dir: &PathBuf) {
    let log_dir = app_data_dir.join("logs");
    fs::create_dir_all(&log_dir).ok();
    let log_dir_str = log_dir.to_string_lossy().to_string();

    let logger = Logger::with_config(
        "MoonCast",
        &log_dir_str,
        &[Output::Console, Output::File],
    );
    let _ = GLOBAL_LOGGER.set(logger);
}

/// 获取全局 Logger 引用。
pub fn global() -> &'static Logger {
    GLOBAL_LOGGER.get().expect("[logger] 未初始化，请先调用 logger_next::init()")
}

/// 便捷方法：输出 INFO 日志到全局 Logger。
pub fn info(args: &[&str]) {
    global().info(args);
}

/// 便捷方法：输出 ERROR 日志到全局 Logger。
pub fn error(args: &[&str]) {
    global().error(args);
}

/// 兼容旧 API：等价于 info(&[message])
pub fn log(message: &str) {
    global().info(&[message]);
}

/// 输出目标
#[derive(Clone, PartialEq)]
pub enum Output {
    Console,
    File,
}

#[derive(Clone)]
pub struct Logger {
    inner: Arc<Mutex<LoggerInner>>,
}

struct LoggerInner {
    name: String,
    path: Option<PathBuf>,
    outputs: Vec<Output>,
}

impl Logger {
    /// 无参构造，全部使用默认值（name="default", 无文件, 只输出控制台）
    pub fn new() -> Self {
        Logger {
            inner: Arc::new(Mutex::new(LoggerInner {
                name: "default".to_string(),
                path: None,
                outputs: vec![Output::Console],
            })),
        }
    }

    /// 指定 name
    pub fn with_name(name: &str) -> Self {
        Logger {
            inner: Arc::new(Mutex::new(LoggerInner {
                name: name.to_string(),
                path: None,
                outputs: vec![Output::Console],
            })),
        }
    }

    /// 完整配置
    pub fn with_config(name: &str, path: &str, outputs: &[Output]) -> Self {
        let logger = Logger {
            inner: Arc::new(Mutex::new(LoggerInner {
                name: name.to_string(),
                path: None,
                outputs: outputs.to_vec(),
            })),
        };
        logger.set_path(path);
        logger
    }

    /// 设置日志文件目录，设置后自动清理超过7天的同 name 日志
    pub fn set_path(&self, path: &str) {
        let path_buf = PathBuf::from(path);
        let mut inner = self.inner.lock().unwrap();
        inner.path = Some(path_buf.clone());
        Self::cleanup_old_logs(&inner.name, &path_buf);
    }

    /// 获取日志目录的绝对路径，未设置 path 时返回 None
    pub fn get_path(&self) -> Option<String> {
        let inner = self.inner.lock().unwrap();
        inner.path.as_ref().map(|p| {
            let abs = fs::canonicalize(p)
                .unwrap_or_else(|_| p.clone())
                .to_string_lossy()
                .to_string();
            // 去掉 Windows 扩展路径前缀 \\?\
            abs.strip_prefix(r"\\?\").unwrap_or(&abs).to_string()
        })
    }

    /// 输出 INFO 级别日志
    pub fn info(&self, args: &[&str]) {
        self.log("INFO", args);
    }

    /// 输出 ERROR 级别日志
    pub fn error(&self, args: &[&str]) {
        self.log("ERROR", args);
    }

    /// 内部日志写入方法
    fn log(&self, level: &str, args: &[&str]) {
        let inner = self.inner.lock().unwrap();
        let now = Local::now();
        let timestamp = now.format("%Y-%m-%d %H:%M:%S%.3f");
        let message = args.join(" ");
        let line = format!("[{}] [{}] [{}] {}", timestamp, inner.name, level, message);

        if inner.outputs.contains(&Output::Console) {
            println!("{}", line);
        }

        if inner.outputs.contains(&Output::File) {
            if let Some(ref dir) = inner.path {
                let date_str = now.format("%Y-%m-%d").to_string();
                let filename = format!("{}_{}.log", inner.name, date_str);
                let file_path = dir.join(&filename);

                if let Err(e) = fs::create_dir_all(dir) {
                    eprintln!("Failed to create log dir: {}", e);
                    return;
                }

                match OpenOptions::new().create(true).append(true).open(&file_path) {
                    Ok(mut f) => {
                        if let Err(e) = writeln!(f, "{}", line) {
                            eprintln!("Failed to write log: {}", e);
                        }
                    }
                    Err(e) => eprintln!("Failed to open log file: {}", e),
                }
            }
        }
    }

    /// 清理超过7天的同 name 日志文件
    fn cleanup_old_logs(name: &str, dir: &Path) {
        if !dir.exists() {
            return;
        }

        let today = Local::now().date_naive();
        let prefix = format!("{}_", name);

        let entries = match fs::read_dir(dir) {
            Ok(entries) => entries,
            Err(_) => return,
        };

        for entry in entries.flatten() {
            let file_name = entry.file_name();
            let file_name_str = file_name.to_string_lossy();

            if !file_name_str.starts_with(&prefix) || !file_name_str.ends_with(".log") {
                continue;
            }

            let date_part = &file_name_str[prefix.len()..file_name_str.len() - 4];
            if let Ok(file_date) = chrono::NaiveDate::parse_from_str(date_part, "%Y-%m-%d") {
                let age = today - file_date;
                if age.num_days() > 7 {
                    if let Err(e) = fs::remove_file(entry.path()) {
                        eprintln!("Failed to remove old log {}: {}", file_name_str, e);
                    }
                }
            }
        }
    }
}
