# 端口 EACCES 权限问题排查

## 现象

启动 Tauri dev server 时报错：

```
Error: listen EACCES: permission denied ::1:3000
    at Server.setupListenHandle [as _listen2] (node:net:1926:21)
    at listenInCluster (node:net:2005:12)
    at GetAddrInfoReqWrap.callback (node:net:2214:7)
    at GetAddrInfoReqWrap.onlookupall [as oncomplete] (node:dns:134:8)

Error The "beforeDevCommand" terminated with a non-zero status code.
```

## 原因

Windows Hyper-V 会动态保留一段 TCP 端口范围，被保留的端口无法被普通应用绑定，即使端口未被任何进程占用也会报 `EACCES`。

## 排查步骤

### 1. 确认端口是否被占用

```bash
netstat -ano | findstr ":3000"
```

如果没有输出，说明端口没有被其他进程占用，问题不在占用。

### 2. 查看 Windows 保留端口范围

```bash
netsh interface ipv4 show excludedportrange protocol=tcp
```

输出示例：

```
开始端口    结束端口
----------    ----------
      1074        1173
      1274        1373
      1374        1473
      2869        2869
      2931        3030    ← 3000 在此范围内
      8498        8597
     12023       12122
     50000       50059   *
```

### 3. 确认 Hyper-V 是否运行

```bash
powershell -Command "Get-Service vmcompute | Format-List Name,Status"
```

`Status: Running` 表示 Hyper-V 正在运行，端口保留由它造成。

### 4. 测试哪些端口可用

```bash
for port in 3000 3001 4000 5173 8080; do
  node -e "const s=require('net').createServer();s.listen($port,'127.0.0.1',()=>{console.log('$port OK');s.close()});s.on('error',e=>console.log('$port '+e.code))"
done
```

输出示例：

```
3000 EACCES
3001 EACCES
4000 OK
5173 OK
8080 OK
```

落在保留范围内的端口报 `EACCES`，范围外的正常。

## 解决方案

### 方案 A：更换端口（推荐）

修改 `vite.config.ts` 和 `src-tauri/tauri.conf.json`，使用保留范围外的端口（如 5173）：

```ts
// vite.config.ts
server: {
  port: 5173,
  // ...
}
```

```json
// src-tauri/tauri.conf.json
"devUrl": "http://localhost:5173"
```

### 方案 B：将端口加入排除列表

以管理员身份运行：

```bash
netsh int ipv4 add excludedportrange protocol=tcp startport=3000 numberofports=1
```

执行后端口 3000 会从 Hyper-V 的动态保留中排除，普通应用即可绑定。

> 注意：需要在 Hyper-V 未占用该端口时执行，否则需重启后再试。
