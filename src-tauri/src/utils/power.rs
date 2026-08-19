use std::process::Command;

/// 电源操作类型。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PowerAction {
    Shutdown,
    Restart,
    Sleep,
    Lock,
}

impl PowerAction {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "shutdown" => Some(Self::Shutdown),
            "restart" => Some(Self::Restart),
            "sleep" => Some(Self::Sleep),
            "lock" => Some(Self::Lock),
            _ => None,
        }
    }
}

/// 执行电源操作。返回 Ok(()) 表示命令已发送。
pub fn execute(action: PowerAction) -> Result<(), String> {
    let result = match action {
        PowerAction::Shutdown => exec_shutdown(),
        PowerAction::Restart => exec_restart(),
        PowerAction::Sleep => exec_sleep(),
        PowerAction::Lock => exec_lock(),
    };
    result.map_err(|e| format!("Failed to execute power action: {}", e))
}

#[cfg(target_os = "windows")]
fn exec_shutdown() -> Result<(), std::io::Error> {
    Command::new("shutdown").args(["/s", "/t", "0"]).spawn()?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn exec_restart() -> Result<(), std::io::Error> {
    Command::new("shutdown").args(["/r", "/t", "0"]).spawn()?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn exec_sleep() -> Result<(), std::io::Error> {
    Command::new("rundll32")
        .args(["powrprof.dll,SetSuspendState", "0,1,0"])
        .spawn()?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn exec_lock() -> Result<(), std::io::Error> {
    Command::new("rundll32")
        .args(["user32.dll,LockWorkStation"])
        .spawn()?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn exec_shutdown() -> Result<(), std::io::Error> {
    Command::new("osascript")
        .args(["-e", "tell app \"System Events\" to shut down"])
        .spawn()?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn exec_restart() -> Result<(), std::io::Error> {
    Command::new("osascript")
        .args(["-e", "tell app \"System Events\" to restart"])
        .spawn()?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn exec_sleep() -> Result<(), std::io::Error> {
    Command::new("pmset").arg("sleepnow").spawn()?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn exec_lock() -> Result<(), std::io::Error> {
    Command::new("osascript")
        .args(["-e", "tell application \"System Events\" to keystroke \"q\" using {control down, command down}"])
        .spawn()?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn exec_shutdown() -> Result<(), std::io::Error> {
    Command::new("systemctl").arg("poweroff").spawn()?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn exec_restart() -> Result<(), std::io::Error> {
    Command::new("systemctl").arg("reboot").spawn()?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn exec_sleep() -> Result<(), std::io::Error> {
    Command::new("systemctl").arg("suspend").spawn()?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn exec_lock() -> Result<(), std::io::Error> {
    Command::new("loginctl").arg("lock-session").spawn()?;
    Ok(())
}
