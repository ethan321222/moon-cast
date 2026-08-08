# 项目命名规范

## 命名分层

| 层级 | 格式 | 示例 | 用途 |
|------|------|------|------|
| 仓库/目录 | kebab-case | `moon-cast` | Git 仓库名、项目目录 |
| 包名 (npm/crate) | kebab-case | `moon-cast` | package.json name、Cargo.toml name |
| 代码内部标识 | snake_case | `moon_cast_lib` | Rust crate lib name、模块名 |
| 面向用户的品牌名 | PascalCase | `MoonCast` | 页面标题、文档标题、README 开头 |

## 规则

1. **仓库名 = npm 包名 = 目录名**，统一用 kebab-case
2. **品牌展示名**用 PascalCase（无空格无连字符），出现在：
   - HTML `<title>`
   - package.json `description` 开头
   - README.md 标题
   - 应用窗口标题
   - Cargo.toml `description`
3. **Rust crate name** 如果与 bin 冲突，加 `_lib` 后缀并用 snake_case
4. **description 格式**：`品牌名 - 一句话描述`，如 `"MoonCast - A cross-platform file casting tool"`

## 示例 package.json

```json
{
  "name": "moon-cast",
  "description": "MoonCast - A cross-platform file casting tool"
}
```

## 示例 Cargo.toml

```toml
[package]
name = "moon-cast"
description = "MoonCast - A cross-platform file casting tool"

[lib]
name = "moon_cast_lib"
```
