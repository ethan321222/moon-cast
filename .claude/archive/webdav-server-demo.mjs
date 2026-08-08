// webdav-server.mjs
// 一个最简 WebDAV 服务器，Node.js 原生实现，帮助理解 webdav.rs 的原理
// 运行: node webdav-server.mjs
// 然后用文件管理器连接 http://localhost:4000/ 或用 curl/fetch 调用

import http from "node:http";
import fs from "node:fs";
import path from "node:path";

// ============ 配置 ============
const PORT = 4000;
const ROOT = path.resolve("./webdav-root"); // 共享的根目录

// 确保根目录存在
fs.mkdirSync(ROOT, { recursive: true });

// ============ 工具函数 ============

/** 将 URL 路径解析为本地文件系统绝对路径（防止路径穿越） */
function resolvePath(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const resolved = path.resolve(ROOT, "." + decoded);
  // 安全检查：不允许跳出根目录
  if (!resolved.startsWith(ROOT)) {
    return null;
  }
  return resolved;
}

/** 生成单个资源的 XML 片段（PROPFIND 响应用） */
function propfindEntry(href, stat) {
  const isDir = stat.isDirectory();
  const lastModified = stat.mtime.toUTCString();
  const contentLength = isDir ? 0 : stat.size;
  const resourceType = isDir ? "<D:collection/>" : "";

  return `
<D:response>
  <D:href>${encodeURI(href)}</D:href>
  <D:propstat>
    <D:prop>
      <D:displayname>${path.basename(href)}</D:displayname>
      <D:getlastmodified>${lastModified}</D:getlastmodified>
      <D:getcontentlength>${contentLength}</D:getcontentlength>
      <D:resourcetype>${resourceType}</D:resourcetype>
    </D:prop>
    <D:status>HTTP/1.1 200 OK</D:status>
  </D:propstat>
</D:response>`;
}

// ============ 请求处理器（对应 webdav.rs 里的各个 handler） ============

const server = http.createServer((req, res) => {
  const urlPath = req.url || "/";
  const localPath = resolvePath(urlPath);

  if (!localPath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  console.log(`${req.method} ${urlPath}`);

  switch (req.method) {
    // ---- OPTIONS: 告诉客户端服务器支持哪些方法 ----
    // 对应 webdav.rs 里的 handle_options()
    case "OPTIONS":
      res.writeHead(200, {
        Allow: "OPTIONS, GET, HEAD, PUT, DELETE, MKCOL, COPY, MOVE, PROPFIND",
        DAV: "1, 2",
      });
      res.end();
      break;

    // ---- GET: 下载文件 ----
    // 对应 handlers.rs 里的 serve_path()
    case "GET":
    case "HEAD": {
      if (!fs.existsSync(localPath)) {
        res.writeHead(404);
        res.end("Not Found");
        return;
      }
      const stat = fs.statSync(localPath);
      if (stat.isDirectory()) {
        // 目录返回简单的文件列表
        const entries = fs.readdirSync(localPath);
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(entries.join("\n"));
      } else {
        res.writeHead(200, {
          "Content-Type": "application/octet-stream",
          "Content-Length": stat.size,
        });
        if (req.method === "HEAD") {
          res.end();
        } else {
          fs.createReadStream(localPath).pipe(res);
        }
      }
      break;
    }

    // ---- PUT: 上传/覆盖文件 ----
    // 对应 webdav.rs 里的 handle_put()
    case "PUT": {
      const dir = path.dirname(localPath);
      if (!fs.existsSync(dir)) {
        res.writeHead(409); // Conflict: 父目录不存在
        res.end("Parent directory does not exist");
        return;
      }
      const exists = fs.existsSync(localPath);
      const writeStream = fs.createWriteStream(localPath);
      req.pipe(writeStream);
      writeStream.on("finish", () => {
        res.writeHead(exists ? 204 : 201); // 204=覆盖, 201=新建
        res.end();
      });
      writeStream.on("error", () => {
        res.writeHead(500);
        res.end("Write failed");
      });
      break;
    }

    // ---- DELETE: 删除文件或目录 ----
    // 对应 webdav.rs 里的 handle_delete()
    case "DELETE": {
      if (!fs.existsSync(localPath)) {
        res.writeHead(404);
        res.end("Not Found");
        return;
      }
      fs.rmSync(localPath, { recursive: true });
      res.writeHead(204);
      res.end();
      break;
    }

    // ---- MKCOL: 创建目录 ----
    // 对应 webdav.rs 里的 handle_mkcol()
    case "MKCOL": {
      if (fs.existsSync(localPath)) {
        res.writeHead(405); // 已存在
        res.end("Already exists");
        return;
      }
      const parent = path.dirname(localPath);
      if (!fs.existsSync(parent)) {
        res.writeHead(409); // 父目录不存在
        res.end("Parent not found");
        return;
      }
      fs.mkdirSync(localPath);
      res.writeHead(201);
      res.end();
      break;
    }

    // ---- MOVE: 移动/重命名 ----
    // 对应 webdav.rs 里的 handle_move()
    case "MOVE": {
      const dest = req.headers["destination"];
      if (!dest) {
        res.writeHead(400);
        res.end("Missing Destination header");
        return;
      }
      // Destination 可能是完整 URL 或绝对路径
      const destPath = resolvePath(new URL(dest, `http://localhost:${PORT}`).pathname);
      if (!destPath) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      if (!fs.existsSync(localPath)) {
        res.writeHead(404);
        res.end("Source not found");
        return;
      }
      const overwrite = req.headers["overwrite"] !== "F";
      if (fs.existsSync(destPath) && !overwrite) {
        res.writeHead(412); // Precondition Failed
        res.end("Destination exists");
        return;
      }
      fs.renameSync(localPath, destPath);
      res.writeHead(201);
      res.end();
      break;
    }

    // ---- COPY: 复制文件/目录 ----
    // 对应 webdav.rs 里的 handle_copy()
    case "COPY": {
      const dest2 = req.headers["destination"];
      if (!dest2) {
        res.writeHead(400);
        res.end("Missing Destination header");
        return;
      }
      const destPath2 = resolvePath(new URL(dest2, `http://localhost:${PORT}`).pathname);
      if (!destPath2) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      if (!fs.existsSync(localPath)) {
        res.writeHead(404);
        res.end("Source not found");
        return;
      }
      fs.cpSync(localPath, destPath2, { recursive: true });
      res.writeHead(201);
      res.end();
      break;
    }

    // ---- PROPFIND: 列出目录属性和子项 ----
    // 对应 webdav.rs 里的 handle_propfind()
    // 这是 WebDAV 最核心的方法，返回 XML 格式的文件列表
    case "PROPFIND": {
      if (!fs.existsSync(localPath)) {
        res.writeHead(404);
        res.end("Not Found");
        return;
      }

      const depth = req.headers["depth"] || "1"; // 0=仅自身, 1=含直接子项
      const stat = fs.statSync(localPath);
      let xmlBody = "";

      // 先加入自身
      xmlBody += propfindEntry(urlPath, stat);

      // depth=1 时加入子项
      if (depth === "1" && stat.isDirectory()) {
        const entries = fs.readdirSync(localPath);
        for (const name of entries) {
          const childPath = path.join(localPath, name);
          try {
            const childStat = fs.statSync(childPath);
            const childHref = urlPath.endsWith("/")
              ? `${urlPath}${name}`
              : `${urlPath}/${name}`;
            xmlBody += propfindEntry(childHref, childStat);
          } catch {
            // 跳过无法访问的文件
          }
        }
      }

      const xml = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
${xmlBody}
</D:multistatus>`;

      res.writeHead(207, {
        "Content-Type": "application/xml; charset=utf-8",
      });
      res.end(xml);
      break;
    }

    default:
      res.writeHead(405);
      res.end("Method Not Allowed");
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 WebDAV 服务器已启动`);
  console.log(`   地址: http://localhost:${PORT}/`);
  console.log(`   根目录: ${ROOT}`);
  console.log(`\n支持的方法: OPTIONS, GET, PUT, DELETE, MKCOL, MOVE, COPY, PROPFIND`);
  console.log(`\n测试:`);
  console.log(`   curl -X MKCOL http://localhost:${PORT}/test-dir/`);
  console.log(`   curl -X PUT -d "hello" http://localhost:${PORT}/test-dir/hello.txt`);
  console.log(`   curl -X PROPFIND -H "Depth: 1" http://localhost:${PORT}/`);
  console.log(`   curl http://localhost:${PORT}/test-dir/hello.txt`);
});
