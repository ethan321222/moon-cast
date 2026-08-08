# Moon-Cast 技术方案与设计文档

## 一、参考项目 EchoFS 技术方案

### 总体架构

EchoFS 是一个单二进制 Rust 文件服务器，将本地目录通过 HTTP 和 WebDAV 协议暴露给浏览器和文件管理器。它有两个前端：

- **命令行模式（CLI）**：无 GUI，终端打印 URL，服务器直接运行
- **桌面控制面板（GUI）**：egui/eframe 原生窗口，仅用于管理服务器

两者共享同一个 Axum 服务器核心。

### 架构分离

| 组件 | 技术 | 职责 | 运行位置 |
|------|------|------|----------|
| 控制面板 | egui（Rust 原生 GUI） | 配置、启动/停止、显示地址和 QR 码、查看日志 | 桌面窗口 |
| 文件浏览器 | 原生 HTML + CSS + JS（编译时嵌入） | 浏览目录、预览、上传、删除、重命名 | 外部浏览器 |
| 服务器核心 | Axum + Tokio | 同时提供 Web UI 和文件/WebDAV 服务 | 后台异步任务 |

### 前端嵌入方式

`template.rs` 通过 `include_str!()` 在编译时将 CSS（~1290 行）和 JS（~1528 行）嵌入 HTML 字符串，形成一个完全自包含的 SPA。浏览器访问时返回这个字符串，JS 再通过 AJAX 获取 JSON 数据渲染页面。

### 请求路由（内容协商）

同一个 URL，根据 `X-Requested-With: XMLHttpRequest` 头判断：

- **有此头（AJAX）** → 返回 JSON（目录列表数据）
- **无此头（浏览器直接访问）** → 返回 HTML SPA 页面

所有响应设置 `Vary: X-Requested-With`。

### 中间件栈（由外到内）

1. DAV 头注入（`DAV: 1, 2` + `Allow` 头）
2. CORS 宽松策略
3. WebUI 认证（可选，对 GET/HEAD 做 Basic Auth）
4. 访问日志记录

### 核心功能

- HTTP 文件流式传输 + Range 请求（视频拖拽进度条）
- 令牌桶限速（`ThrottledRead`）
- 完整 WebDAV 实现（PROPFIND/PUT/DELETE/MKCOL/COPY/MOVE/LOCK）
- 路径遍历防护（canonicalize + starts_with 检查）
- 隐藏文件过滤、最大深度限制
- 局域网 IP 发现（UDP 探测 + getifaddrs）
- QR 码生成（egui 面板内）

### 存储方案

**纯内存，无持久化。** 配置仅存在于运行时的 struct 中，关闭即丢失。每次启动使用默认值。

### 依赖

| 用途 | 库 |
|------|-----|
| Web 框架 | axum 0.8 |
| 异步运行时 | tokio 1 (full) |
| CORS | tower-http 0.6 |
| CLI 解析 | clap 4 |
| 序列化 | serde + serde_json |
| MIME 检测 | mime_guess 2 |
| 时间 | chrono 0.4 |
| URL 编码 | percent-encoding 2 |
| GUI（可选） | eframe 0.35, rfd 0.17, qrcode 0.14 |

---

## 二、Moon-Cast 的改动

### 核心改动：技术栈替换

| 方面 | EchoFS | Moon-Cast |
|------|--------|-----------|
| 桌面窗口 | egui（Rust 原生 GUI） | **Tauri v2 + React 19** |
| 文件浏览器 UI | 原生 JS（`template.js` 1528 行） | **React 组件化 SPA**（TypeScript） |
| 前端嵌入 | `include_str!()` 拼接 HTML 字符串 | **rust-embed** 嵌入 Vite 构建产物 |
| CLI 解析 | clap | 无（纯桌面应用，不需要 CLI） |
| 配置来源 | CLI 参数 / egui 表单 | Tauri IPC 从 React 控制面板传入 |
| 文件夹选择 | rfd（Rust File Dialog） | tauri-plugin-dialog |
| 打开浏览器 | open crate | tauri-plugin-opener |
| QR 码 | qrcode crate（Rust，egui 渲染） | qrcode npm 包（Canvas 渲染） |

### 架构改动：单入口运行时分支

```
App.tsx
├── window.__TAURI_INTERNALS__ 存在？
│   └── 是 → <ControlPanel />    （Tauri 窗口，IPC 通信）
│   └── 否 → <FileBrowser />     （外部浏览器，HTTP 通信）
```

同一份 `dist/` 构建产物：
- Tauri 窗口加载 → 显示控制面板
- Axum 嵌入返回给外部浏览器 → 显示文件浏览器

### 新增功能

1. **全局拖拽上传** — 任意位置拖入文件，全屏覆盖提示，松手即上传
2. **上传队列** — 多文件并发上传（4 worker），带进度条
3. **图片画廊导航** — 上一张/下一张按钮、键盘左右箭头、触摸滑动、计数器
4. **客户端 QR 码** — 浏览器端任意页面可生成当前 URL 的二维码
5. **三种视图模式** — 表格、网格、卡片，独立切换
6. **主题系统** — 经典/玻璃/卡通 + 独立的明暗模式切换
7. **动态页面标题** — 随当前目录名变化
8. **新建文件夹按钮** — 非空目录中也可用

### 保持不变的部分

以下模块从 EchoFS 直接移植，逻辑基本一致：

- `server.rs` — Axum 路由器、中间件栈、优雅关闭（唯一改动：启动时 canonicalize root）
- `webdav.rs` — 完整 WebDAV 实现（~29KB）
- `directory.rs` — 目录列表、路径安全检查、面包屑
- `range.rs` — HTTP Range 请求支持
- `throttle.rs` — 令牌桶限速
- `mime_utils.rs` — MIME 检测 + 图标分类
- `error.rs` — 错误类型 + 内容协商响应
- `netinfo.rs` — 局域网 IP 发现
- `logging.rs` — 访问日志（stdout/channel 两种目标）

### 文件结构

```
moon-cast/
├── src/                          # React 前端
│   ├── App.tsx                   # 环境判断，分支渲染
│   ├── api/client.ts             # API 层（fetch + Tauri IPC）
│   ├── components/
│   │   ├── ControlPanel.tsx      # 控制面板（替代 egui gui.rs）
│   │   ├── FileBrowser.tsx       # 文件浏览器（替代 template.js）
│   │   ├── FileList.tsx          # 文件列表（表格/网格/卡片）
│   │   ├── Preview.tsx           # 媒体预览（画廊导航）
│   │   ├── QrModal.tsx           # QR 码弹窗
│   │   ├── UploadZone.tsx        # 上传区域
│   │   ├── Breadcrumbs.tsx       # 面包屑导航
│   │   └── Toast.tsx             # 通知提示
│   ├── types/index.ts            # TypeScript 类型定义
│   └── styles/                   # CSS（全局 + 主题）
├── src-tauri/                    # Rust 后端
│   └── src/
│       ├── lib.rs                # Tauri 入口
│       ├── commands.rs           # 7 个 Tauri IPC 命令
│       ├── config.rs             # ServerConfig（内存存储）
│       ├── server.rs             # Axum 服务器（同 EchoFS）
│       ├── handlers.rs           # HTTP 处理器（AJAX/SPA 分支）
│       ├── spa.rs                # rust-embed 嵌入 React SPA
│       ├── webdav.rs             # WebDAV（同 EchoFS）
│       ├── directory.rs          # 目录操作（同 EchoFS）
│       ├── range.rs              # Range 请求（同 EchoFS）
│       ├── throttle.rs           # 限速（同 EchoFS）
│       ├── mime_utils.rs         # MIME 检测（同 EchoFS）
│       ├── netinfo.rs            # 网络发现（同 EchoFS）
│       ├── logging.rs            # 日志（同 EchoFS）
│       └── error.rs              # 错误处理（同 EchoFS）
├── package.json                  # React 19, Vite 7, qrcode
└── src-tauri/Cargo.toml          # tauri 2, axum 0.8, rust-embed
```
