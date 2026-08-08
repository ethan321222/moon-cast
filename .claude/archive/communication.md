# 前后端通信架构

本项目基于 Tauri，前后端有**两条通信链路**，各司其职。

## 1. Tauri IPC（控制面板）

控制面板页面（启动/停止服务器、修改配置、隧道管理等）通过 Tauri 的 Command 机制通信。

### 后端定义

```rust
// src-tauri/src/commands.rs
#[tauri::command]
pub async fn start_server(state: State<'_, AppState>) -> Result<ServerStatus, String> { ... }
```

在 `lib.rs` 中注册：

```rust
.invoke_handler(tauri::generate_handler![
    commands::start_server,
    commands::stop_server,
    commands::get_config,
    // ...
])
```

### 前端调用

```ts
// src/api/client.ts
import { invoke } from "@tauri-apps/api/core";

await invoke("start_server");
const config = await invoke("get_config");
```

### 事件推送（后端 → 前端）

后端主动通知前端：

```rust
app_handle.emit("address-ready", &address_entry).unwrap();
```

前端监听：

```ts
import { listen } from "@tauri-apps/api/event";

const unlisten = listen<AddressEntry>("address-ready", (event) => {
  // event.payload 是后端推送的数据
});
```

---

## 2. HTTP fetch（文件浏览器）

文件浏览页面**不走 Tauri IPC**，而是直接向 Rust 启动的内嵌 HTTP 文件服务器发请求。

### 请求示例

| 操作 | HTTP 方法 | 示例 |
|---|---|---|
| 列目录 | GET | `fetch("/photos", { headers: { "X-Requested-With": "XMLHttpRequest" } })` |
| 下载/预览文件 | GET | `fetch("/photos/cat.jpg")` |
| 上传文件 | PUT | `PUT /photos/cat.jpg` + body |
| 删除 | DELETE | `DELETE /photos/cat.jpg` |
| 新建文件夹 | MKCOL | `MKCOL /photos/new-folder` |
| 重命名/移动 | MOVE | `MOVE /photos/old.jpg` + `Destination: /photos/new.jpg` |

### 前端代码

```ts
// src/api/client.ts
export async function listDirectory(path: string): Promise<DirResponse> {
  const resp = await fetch(`/${path}`, {
    headers: { "X-Requested-With": "XMLHttpRequest" },
  });
  return resp.json();
}
```

### 为什么这样设计

这个 app 本身就是一个文件共享服务器（`server.rs` 启动 Axum HTTP 服务）。外部浏览器和局域网用户通过这个 HTTP 服务访问文件，app 内置的文件浏览页面也复用同一个服务。好处：

- **一致性** — 内置页面和外部浏览器看到完全一样的功能
- **复用** — 文件操作复用 WebDAV 协议（PUT/DELETE/MKCOL/MOVE），不用单独实现一套 IPC command
- **区分方式** — `handlers.rs` 通过 `X-Requested-With: XMLHttpRequest` 头区分请求来源：有此头返回 JSON，无则返回 SPA 页面

---

## 总结

| 场景 | 通信方式 | 前端入口 | 后端入口 |
|---|---|---|---|
| 服务器控制、配置、隧道 | Tauri IPC (`invoke`) | `@tauri-apps/api/core` | `commands.rs` (`#[tauri::command]`) |
| 后端主动推送事件 | Tauri Event (`emit`/`listen`) | `@tauri-apps/api/event` | `AppHandle::emit()` |
| 文件浏览、上传、删除、重命名 | HTTP fetch（内嵌服务器） | `fetch()` / `XMLHttpRequest` | `handlers.rs` / `webdav.rs` |
