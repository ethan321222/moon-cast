# 图标生成工具

moon-cast 应用图标通过 Node 脚本自动生成，一键适配 Windows / macOS / Linux 全平台。

## 原理

1. 使用 `@napi-rs/canvas`（Node 端 Canvas API）复刻 CSS 中的月球渐变
2. 导出 1024×1024 PNG 源图
3. 通过 `npx tauri icon` 自动生成所有平台所需格式

## 快速使用

```bash
# 1. 生成 1024x1024 源图
node scripts/generate-icon.mjs

# 2. 自动生成全平台图标（ico / icns / 多尺寸 png）
npx tauri icon src-tauri/icons/icon.png

# 3. 清除 Rust 编译缓存，使新图标生效
cargo clean --manifest-path src-tauri/Cargo.toml -p moon-cast

# 4. 重新启动开发模式
npx tauri dev
```

## 注意事项：图标更新后不生效？

Tauri 的窗口图标和托盘图标是**编译时嵌入**到 Rust 二进制中的（通过 `tauri::generate_context!()` 宏），不是运行时读取文件。因此替换 `src-tauri/icons/` 下的图片文件后，必须**重新编译 Rust 后端**才能看到变化。

```bash
# 清除旧编译产物（强制重新编译）
cargo clean --manifest-path src-tauri/Cargo.toml -p moon-cast

# 或者直接删除可执行文件
# Windows: del src-tauri\target\debug\moon-cast.exe
# macOS/Linux: rm src-tauri/target/debug/moon-cast
```

然后重新 `npx tauri dev` 即可。

> **为什么 `bundle.icon` 不够？**
> `bundle.icon` 只在 `tauri build` 打包安装程序时使用（设置安装后的桌面图标）。
> 开发模式下的窗口标题栏图标和托盘图标来源于 `generate_context!()` 编译时嵌入的 PNG。
> 两者都读取 `src-tauri/icons/` 下的文件，但生效时机不同：一个是编译时，一个是打包时。

## 生成的文件

| 文件 | 平台 | 用途 |
|------|------|------|
| `icon.ico` | Windows | 桌面快捷方式、任务栏、资源管理器 |
| `icon.icns` | macOS | Dock、Finder、应用程序 |
| `32x32.png` | Linux | 任务栏、窗口标题栏 |
| `128x128.png` | Linux | 应用启动器、文件管理器 |
| `128x128@2x.png` | Linux/macOS | HiDPI 显示 |
| `Square*.png` | Windows | UWP / Microsoft Store 磁贴 |
| `StoreLogo.png` | Windows | Microsoft Store 商品页 |

所有图标输出到 `src-tauri/icons/` 目录。

## 设计参数

CSS 原始定义（`Sidebar.tsx` 中的 `.cp-brand-logo`）：

```css
background: radial-gradient(circle at 35% 30%, #fff5d6, #f5a623 55%, #b88a2e);
```

Canvas 复刻逻辑：

- 径向渐变中心：`(35%, 30%)` — 模拟左上方光源
- 色标：`#fff5d6`(高光) → `#f5a623`(主色, 55%) → `#b88a2e`(暗部)
- 额外添加边缘暗角渐变增加立体感

## 自定义修改

如果需要调整图标样式，编辑 `scripts/generate-icon.mjs` 中的渐变参数：

```js
// 修改渐变颜色
gradient.addColorStop(0, "#fff5d6");     // 高光色
gradient.addColorStop(0.55, "#f5a623");  // 主色
gradient.addColorStop(1, "#b88a2e");     // 暗部色

// 修改光源位置（当前：左上 35%, 30%）
const gradient = ctx.createRadialGradient(
  size * 0.35, size * 0.30, 0,
  size * 0.35, size * 0.30, size * 0.7
);
```

修改后重新执行两步命令即可。

## 依赖

- `@napi-rs/canvas` — Node 端 Canvas 绘图（devDependency）
- `@tauri-apps/cli` — 提供 `tauri icon` 命令（已包含在项目中）
