# 编译问题排查与解决记录

## 问题概述

Tauri Rust 后端编译失败，前端（TypeScript + Vite）编译正常通过。

---

## 问题一：Tauri 依赖版本不兼容

### 错误现象

```
error[E0308]: mismatched types
 --> tauri-build-2.0.6\src\lib.rs:476:10
    |
476 |   if let Some(merged_config_path) = merged_config_path {
    |          expected `Vec<PathBuf>`, found `Option<_>`

error[E0061]: this function takes 3 arguments but 2 arguments were supplied
 --> tauri-build-2.0.6\src\lib.rs:533:26
    |
533 |   ResourcePaths::new(external_binaries(paths, &target_triple).as_slice(), true)
    |   argument #3 of type `&tauri_utils::platform::Target` is missing
```

### 原因分析

`Cargo.toml` 中对 Tauri 相关依赖设置了过于严格的版本上限约束：

```toml
# 旧配置（有问题）
tauri-build = { version = ">=2, <2.1", features = [] }
tauri = { version = ">=2, <2.9", features = ["tray-icon"] }
tauri-plugin-opener = ">=2, <2.3"
tauri-plugin-dialog = ">=2, <2.3"
tauri-plugin-shell = ">=2, <2.3"
```

这导致 `tauri-build` 锁定在 2.0.6，但其传递依赖 `tauri-utils` 被解析到 2.9.3，两者之间 API 签名已发生变化，产生编译错误。

### 解决方案

放宽版本约束，让 Cargo 自动解析兼容的版本组合：

```toml
# 新配置（已修复）
tauri-build = { version = "2", features = [] }
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-opener = "2"
tauri-plugin-dialog = "2"
tauri-plugin-shell = "2"
```

然后执行：

```bash
cd src-tauri
cargo update
```

---

## 问题二：windows crate 编译时内存溢出

### 错误现象

```
error: could not compile `windows` (lib)
Caused by:
  process didn't exit successfully (exit code: 0xc0000409, STATUS_STACK_BUFFER_OVERRUN)
```

编译器在编译 `windows 0.61.3` crate 时因内存不足崩溃（OOM），该 crate 开启了大量 Win32 feature flags，编译时内存消耗极大。

### 原因分析

默认 `cargo build` 使用 CPU 核心数作为并行编译任务数，多个大型 crate 同时编译会导致内存峰值过高，超出系统可用内存。

### 解决方案

限制编译并行度，降低内存峰值：

```bash
cargo build -j 2
```

如果仍有问题，可进一步降低到 `-j 1`，或增加系统虚拟内存（页面文件）大小。

---

## 完整修复步骤

```bash
# 1. 修改 src-tauri/Cargo.toml 中的版本约束（见上文）

# 2. 更新依赖锁文件
cd src-tauri
cargo update

# 3. 限制并行度编译
cargo build -j 2
```

---

## 经验总结

| 要点 | 说明 |
|------|------|
| 避免过严版本上限 | Tauri 生态迭代快，`<2.1` 这类约束容易导致传递依赖不兼容 |
| 使用 SemVer 主版本约束 | `"2"` 等价于 `>=2.0.0, <3.0.0`，能兼容 patch 和 minor 更新 |
| Windows 大 crate 编译注意内存 | `windows` crate feature 多时编译内存消耗巨大，需控制并行度 |
| 定期 `cargo update` | 保持 Cargo.lock 中依赖版本同步，减少版本漂移导致的兼容问题 |
