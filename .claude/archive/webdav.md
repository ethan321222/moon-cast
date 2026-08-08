# WebDAV 协议说明

## 原理（一句话版）

WebDAV = 把文件系统操作（读/写/删/建目录/移动/复制/列目录）映射成了 HTTP 请求。客户端用不同的 HTTP 方法 + URL 路径告诉服务器要做什么，服务器在本地磁盘上执行对应操作。

## 核心原理

**它就是一个 HTTP 服务器，只不过除了 GET 以外，还处理了更多的 HTTP 方法。**

### 普通 HTTP 服务器

```
浏览器发 GET /cat.jpg  →  服务器读文件，返回内容
```

只能"看"，不能"改"。

### WebDAV 服务器

在这个基础上多约定了几个动词：

```
客户端发 PUT /cat.jpg + 文件内容  →  服务器写入到磁盘（上传）
客户端发 DELETE /cat.jpg          →  服务器删除这个文件
客户端发 MKCOL /new-folder/      →  服务器创建目录（MaKe COLlection）
客户端发 MOVE /old.jpg            →  服务器重命名（目标路径放在 Destination 头里）
客户端发 PROPFIND /photos/        →  服务器返回目录里有哪些文件（XML 格式）
```

### 三个关键点

1. **HTTP 方法当动词** — GET=读、PUT=写、DELETE=删、MKCOL=建目录、MOVE=移动、COPY=复制
2. **URL 路径当文件路径** — `PUT /photos/cat.jpg` 就是往 `photos/cat.jpg` 这个位置写文件
3. **PROPFIND 是唯一特殊的** — 它用来"列目录"，返回 XML 格式的文件列表（名字、大小、修改时间），因为 HTTP 本身没有"列目录"这个语义

所以 Windows/macOS 的文件管理器能直接"挂载"WebDAV 地址当网络磁盘用——操作系统把你的文件操作翻译成 HTTP 请求发出去就行了。

## 为什么用 XML

WebDAV 是 1999 年定的标准（RFC 2518），那个年代 JSON 还没出生（JSON 是 2001 年才有的），XML 是当时唯一的结构化数据格式。

PROPFIND 需要返回的数据比较复杂——一个目录下多个文件，每个文件有多个属性（名字、大小、时间、类型、锁状态等），XML 的嵌套结构正好能表达这种层级关系。标准定死了响应格式必须是 XML，所有 WebDAV 客户端（Windows 文件管理器、macOS Finder 等）都按这个格式解析，改不了了。

所以项目里才需要 `XmlWriter` 这个工具——手动拼 XML 只是因为协议要求，如果 WebDAV 是今天设计的，肯定用 JSON。

## 什么是 WebDAV（正式定义）

WebDAV（Web Distributed Authoring and Versioning）是 HTTP 协议的扩展，在标准 GET/POST 之上增加了文件管理能力。它不是独立的服务器，而是**挂载在同一个 HTTP 服务器上的一组额外方法**。

本项目的 WebDAV 实现完全手写，没有使用第三方 WebDAV 库，仅依赖 Axum（HTTP 框架）+ 自写的 XML 构建器。

## 支持的方法

| HTTP 方法 | 作用 | 类比 |
|---|---|---|
| `GET` | 下载文件 | 普通 HTTP 下载 |
| `PUT` | 上传/覆盖文件 | `fs.writeFile()` |
| `DELETE` | 删除文件或目录 | `fs.rm()` |
| `MKCOL` | 创建目录 | `fs.mkdir()` |
| `COPY` | 复制文件/目录 | `fs.cp()` |
| `MOVE` | 移动/重命名 | `fs.rename()` |
| `PROPFIND` | 列出目录内容和属性 | `fs.readdir()` + `fs.stat()` |
| `PROPPATCH` | 修改属性（本项目为空实现） | — |
| `LOCK/UNLOCK` | 锁定文件（本项目为简化实现） | — |
| `OPTIONS` | 查询服务器能力 | — |

## 在项目中的位置

```
src/server/
├── mod.rs       — 路由注册（GET → handlers, 其他方法 → webdav）
├── handlers.rs  — 处理 GET 请求（浏览器查看/下载）
└── webdav.rs    — 处理 PUT/DELETE/MKCOL/COPY/MOVE/PROPFIND 等
```

同一个端口，同一个服务器：
- 浏览器访问 `GET /photos/cat.jpg` → handlers 返回文件
- WebDAV 客户端 `PUT /photos/cat.jpg` → webdav 处理上传

## Node.js 使用示例

假设服务器运行在 `http://localhost:8080`，启用了 WebDAV。

### 列出目录内容（PROPFIND）

```js
const resp = await fetch("http://localhost:8080/photos/", {
  method: "PROPFIND",
  headers: { Depth: "1" }, // 0=仅当前, 1=含子项
});
const xml = await resp.text();
console.log(xml); // 返回 XML 格式的文件列表
```

### 上传文件（PUT）

```js
import fs from "fs";

const fileBuffer = fs.readFileSync("./cat.jpg");
const resp = await fetch("http://localhost:8080/photos/cat.jpg", {
  method: "PUT",
  body: fileBuffer,
});
console.log(resp.status); // 201 Created 或 204 No Content（覆盖）
```

### 创建目录（MKCOL）

```js
const resp = await fetch("http://localhost:8080/photos/vacation/", {
  method: "MKCOL",
});
console.log(resp.status); // 201 Created
```

### 删除文件或目录（DELETE）

```js
const resp = await fetch("http://localhost:8080/photos/old.jpg", {
  method: "DELETE",
});
console.log(resp.status); // 204 No Content
```

### 重命名/移动（MOVE）

```js
const resp = await fetch("http://localhost:8080/photos/old.jpg", {
  method: "MOVE",
  headers: {
    Destination: "/photos/new.jpg",
    Overwrite: "F", // T=覆盖, F=不覆盖
  },
});
console.log(resp.status); // 201 Created
```

### 复制（COPY）

```js
const resp = await fetch("http://localhost:8080/photos/cat.jpg", {
  method: "COPY",
  headers: {
    Destination: "/backup/cat.jpg",
    Overwrite: "T",
  },
});
console.log(resp.status); // 201 Created
```

### 带认证的请求

如果开启了 Basic Auth：

```js
const credentials = btoa("admin:password123");
const resp = await fetch("http://localhost:8080/photos/", {
  method: "PROPFIND",
  headers: {
    Depth: "1",
    Authorization: `Basic ${credentials}`,
  },
});
```

## 常见 WebDAV 客户端

除了代码调用，WebDAV 还能直接被操作系统挂载为网络磁盘：

- **Windows**: 文件管理器 → 映射网络驱动器 → `http://ip:port/`
- **macOS**: Finder → 前往 → 连接服务器 → `http://ip:port/`
- **Linux**: 文件管理器输入 `dav://ip:port/`
- **移动端**: Documents、nPlayer 等 app 支持 WebDAV 源

## Node.js 完整 Demo

将以下代码保存为 `webdav-demo.mjs`，执行 `node webdav-demo.mjs` 即可体验全部操作。

```js
// webdav-demo.mjs
// 需要 Node.js 18+（内置 fetch）

const BASE = "http://localhost:8080";

// 如果开启了认证，取消下面注释并填入用户名密码
// const AUTH = `Basic ${Buffer.from("admin:password").toString("base64")}`;
const AUTH = undefined;

function headers(extra = {}) {
  const h = { ...extra };
  if (AUTH) h["Authorization"] = AUTH;
  return h;
}

async function main() {
  console.log("=== 1. 创建目录 ===");
  let resp = await fetch(`${BASE}/demo-test/`, {
    method: "MKCOL",
    headers: headers(),
  });
  console.log(`MKCOL /demo-test/ → ${resp.status}`);

  console.log("\n=== 2. 上传文件 ===");
  const content = "Hello WebDAV! 这是一个测试文件。";
  resp = await fetch(`${BASE}/demo-test/hello.txt`, {
    method: "PUT",
    headers: headers({ "Content-Type": "text/plain" }),
    body: content,
  });
  console.log(`PUT /demo-test/hello.txt → ${resp.status}`);

  console.log("\n=== 3. 列出目录（PROPFIND） ===");
  resp = await fetch(`${BASE}/demo-test/`, {
    method: "PROPFIND",
    headers: headers({ Depth: "1" }),
  });
  const xml = await resp.text();
  console.log(`PROPFIND /demo-test/ → ${resp.status}`);
  console.log(xml.substring(0, 500) + "...\n");

  console.log("=== 4. 下载文件（GET） ===");
  resp = await fetch(`${BASE}/demo-test/hello.txt`, {
    headers: headers(),
  });
  const text = await resp.text();
  console.log(`GET /demo-test/hello.txt → ${resp.status}`);
  console.log(`内容: ${text}`);

  console.log("\n=== 5. 重命名文件（MOVE） ===");
  resp = await fetch(`${BASE}/demo-test/hello.txt`, {
    method: "MOVE",
    headers: headers({ Destination: "/demo-test/renamed.txt", Overwrite: "T" }),
  });
  console.log(`MOVE hello.txt → renamed.txt: ${resp.status}`);

  console.log("\n=== 6. 复制文件（COPY） ===");
  resp = await fetch(`${BASE}/demo-test/renamed.txt`, {
    method: "COPY",
    headers: headers({ Destination: "/demo-test/copy.txt", Overwrite: "T" }),
  });
  console.log(`COPY renamed.txt → copy.txt: ${resp.status}`);

  console.log("\n=== 7. 删除文件 ===");
  resp = await fetch(`${BASE}/demo-test/copy.txt`, {
    method: "DELETE",
    headers: headers(),
  });
  console.log(`DELETE /demo-test/copy.txt → ${resp.status}`);

  resp = await fetch(`${BASE}/demo-test/renamed.txt`, {
    method: "DELETE",
    headers: headers(),
  });
  console.log(`DELETE /demo-test/renamed.txt → ${resp.status}`);

  console.log("\n=== 8. 删除目录 ===");
  resp = await fetch(`${BASE}/demo-test/`, {
    method: "DELETE",
    headers: headers(),
  });
  console.log(`DELETE /demo-test/ → ${resp.status}`);

  console.log("\n✅ 全部完成！");
}

main().catch(console.error);
```

运行前确保：
1. MoonCast 服务器已启动且开启了 WebDAV
2. 端口默认 8080，如有修改请改 `BASE` 变量
