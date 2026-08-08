# Tauri 插件机制说明

## 为什么 Tauri 需要插件，Electron 不需要

### Electron — 全包式

Electron 内置了 Node.js，所有系统能力（文件对话框、通知、剪贴板、shell 等）开箱即用：

```js
const { dialog } = require('electron');
dialog.showOpenDialog(...); // 直接用，不需要装任何东西
```

代价是**打包体积大**（Electron 最小 ~80MB），不管你用不用这些功能，全都打包进去了。

### Tauri — 按需加载式

Tauri 核心只保留最小运行时（WebView + IPC），其他能力全部拆成插件：

```toml
# Cargo.toml — 用什么装什么
tauri-plugin-dialog = "2"    # 对话框
tauri-plugin-shell = "2"     # 打开外部程序
tauri-plugin-opener = "2"    # 打开 URL/文件
```

不用对话框？不装，最终二进制里就没有这段代码。

代价是**需要显式声明依赖 + 调用 init 注册**，好处是**打包体积小**（Tauri 最小 ~3MB）。

### 一句话总结

- Electron：自带全家桶，方便但臃肿
- Tauri：插件化按需加载，多一步 init 但产物小 20 倍

## 本项目使用的插件

```rust
// src-tauri/src/lib.rs
tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())   // 打开 URL / 用系统默认程序打开文件
    .plugin(tauri_plugin_dialog::init())   // 系统原生对话框（文件选择、消息弹窗）
    .plugin(tauri_plugin_shell::init())    // 执行外部命令、打开终端
```

## 前端使用示例

### 安装前端依赖

```bash
npm install @tauri-apps/plugin-dialog @tauri-apps/plugin-shell @tauri-apps/plugin-opener
```

### 文件选择对话框

```ts
import { open } from "@tauri-apps/plugin-dialog";

// 选择文件
const file = await open({
  filters: [{ name: "Images", extensions: ["png", "jpg", "gif"] }],
  multiple: false,
});
console.log(file); // "C:\Users\xxx\photos\cat.png" 或 null

// 选择文件夹
const folder = await open({ directory: true });
console.log(folder); // "C:\Users\xxx\Documents" 或 null
```

### 消息弹窗 & 确认框

```ts
import { message, confirm } from "@tauri-apps/plugin-dialog";

// 消息提示
await message("操作完成！", { title: "提示", kind: "info" });

// 确认框
const yes = await confirm("确定要删除吗？", { title: "警告", kind: "warning" });
if (yes) {
  // 用户点了确定
}
```

### 打开外部链接 / 文件

```ts
import { openUrl, openPath } from "@tauri-apps/plugin-opener";

// 打开浏览器
await openUrl("https://github.com");

// 用系统默认程序打开文件
await openPath("C:\\Users\\xxx\\document.pdf");
```

### 执行外部命令

```ts
import { Command } from "@tauri-apps/plugin-shell";

// 执行命令并获取输出
const output = await Command.create("echo", ["Hello from shell"]).execute();
console.log(output.stdout); // "Hello from shell"
```

## 完整 Demo

下面是一个完整的前端组件示例，展示所有插件的典型用法：

```tsx
import { open, message, confirm } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";

export function PluginDemo() {
  const handleSelectFile = async () => {
    const file = await open({
      title: "选择一个文件",
      filters: [
        { name: "所有文件", extensions: ["*"] },
        { name: "图片", extensions: ["png", "jpg", "gif"] },
      ],
    });
    if (file) {
      await message(`你选择了: ${file}`, { title: "选择结果" });
    }
  };

  const handleSelectFolder = async () => {
    const folder = await open({ directory: true, title: "选择文件夹" });
    if (folder) {
      await message(`你选择了: ${folder}`, { title: "文件夹" });
    }
  };

  const handleDelete = async () => {
    const yes = await confirm("确定要执行此操作吗？", {
      title: "确认",
      kind: "warning",
    });
    if (yes) {
      await message("已执行！", { title: "完成" });
    }
  };

  const handleOpenGithub = async () => {
    await openUrl("https://github.com");
  };

  return (
    <div>
      <button onClick={handleSelectFile}>选择文件</button>
      <button onClick={handleSelectFolder}>选择文件夹</button>
      <button onClick={handleDelete}>确认对话框</button>
      <button onClick={handleOpenGithub}>打开 GitHub</button>
    </div>
  );
}
```

## 与 Electron 的对比

| 功能 | Electron | Tauri |
|---|---|---|
| 文件选择 | `dialog.showOpenDialog()` | `open()` from `@tauri-apps/plugin-dialog` |
| 消息弹窗 | `dialog.showMessageBox()` | `message()` from `@tauri-apps/plugin-dialog` |
| 打开链接 | `shell.openExternal(url)` | `openUrl()` from `@tauri-apps/plugin-opener` |
| 执行命令 | `child_process.exec()` | `Command.create().execute()` from `@tauri-apps/plugin-shell` |
| 使用前 | 无需安装，直接用 | 需 `npm install` + Rust 端 `.plugin(xxx::init())` |
| 打包体积 | 全部包含 ~80MB+ | 按需加载 ~3MB+ |

## 从零跑通一个插件（最小 Demo）

### 项目结构

```
my-demo/
├── src-tauri/
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs
│       └── lib.rs
├── src/
│   └── main.ts
├── index.html
└── package.json
```

### 1. Cargo.toml — 声明 Rust 端依赖

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-dialog = "2"
```

### 2. main.rs — 程序入口

```rust
fn main() {
    app_lib::run();
}
```

### 3. lib.rs — 注册插件

```rust
pub fn run() {
    tauri::Builder::default()
        // 注册 dialog 插件
        // 类比 Express: app.use(dialogMiddleware())
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

就这么多 Rust 代码。`.plugin(xxx::init())` 就是告诉 Tauri："我这个 app 需要对话框能力，帮我注册好 IPC 通道"。

### 4. package.json — 安装前端 npm 包

```bash
npm install @tauri-apps/plugin-dialog
```

### 5. index.html — 页面

```html
<!DOCTYPE html>
<html>
<body>
  <h1>Tauri Plugin Demo</h1>
  <button id="btn-open">选择文件</button>
  <button id="btn-confirm">确认对话框</button>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

### 6. main.ts — 前端调用插件

```ts
import { open, message, confirm } from "@tauri-apps/plugin-dialog";

// 点击 → 弹出系统文件选择框
document.getElementById("btn-open")!.addEventListener("click", async () => {
  const file = await open({
    title: "选择一个文件",
    filters: [{ name: "所有文件", extensions: ["*"] }],
  });
  if (file) {
    await message(`你选择了: ${file}`, { title: "结果" });
  }
});

// 点击 → 弹出确认框
document.getElementById("btn-confirm")!.addEventListener("click", async () => {
  const yes = await confirm("确定吗？", { title: "确认" });
  await message(yes ? "你点了确定" : "你点了取消", { title: "结果" });
});
```

### 工作流程

```
你点击"选择文件"按钮
       ↓
前端调用 open()
       ↓
@tauri-apps/plugin-dialog 通过 IPC 发消息给 Rust
       ↓
Rust 端的 tauri-plugin-dialog 收到消息
       ↓
调用操作系统原生 API（Windows: GetOpenFileName / macOS: NSOpenPanel）
       ↓
弹出系统文件选择框
       ↓
用户选完文件，路径通过 IPC 返回给前端
       ↓
你拿到 "C:\Users\xxx\cat.jpg"
```

### 类比 Express

```js
// Express 中间件模式
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());                      // 注册能力 ← 对应 .plugin(xxx::init())
```

```rust
// Tauri 插件模式（做的事一样）
tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())  // 注册能力
```

区别是 Express 的中间件处理 HTTP 请求，Tauri 的插件处理 IPC 请求（前端 → Rust）。

### 步骤总结

| 步骤 | 做什么 | 类比 Node.js |
|---|---|---|
| Cargo.toml 加依赖 | 安装 Rust 端 | `npm install express` |
| `.plugin(xxx::init())` | 注册到 Tauri | `app.use(middleware)` |
| `npm install @tauri-apps/plugin-xxx` | 安装前端端 | `npm install axios` |
| `import { open } from "..."` | 前端调用 | `axios.get(...)` |
