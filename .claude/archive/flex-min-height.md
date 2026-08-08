# Flex 子项高度收缩：min-h-0

## 问题

Flex 子项默认 `min-height: auto`，即**不会比自身内容更矮**。即使父容器高度受限，子项也不会收缩，导致溢出出现滚动条。

## 原理

```css
/* 默认值 */
min-height: auto;  /* 子项最小高度 = 内容高度，无法收缩 */

/* 修复 */
min-height: 0;     /* 允许子项收缩到比内容更小 */
```

配合 `flex-shrink: 1`（Tailwind: `shrink`）和 `object-fit: contain`，子项就能在父容器变小时等比缩小。

## 三件套

| 属性 | Tailwind | 作用 |
|---|---|---|
| `min-height: 0` | `min-h-0` | 允许 flex 子项突破内容高度下限 |
| `flex-shrink: 1` | `shrink` | 参与 flex 压缩 |
| `object-fit: contain` | `object-contain` | 保持宽高比，不变形 |

## Demo

### 问题复现

```html
<div style="height: 200px; display: flex; flex-direction: column; overflow: auto;">
  <img src="large-image.png" style="max-width: 100%;" />
  <p>Some text</p>
</div>
```

图片 500px 高，容器只有 200px，出现垂直滚动条。`max-width: 100%` 只管宽度，高度不受限。

### 修复

```html
<div style="height: 200px; display: flex; flex-direction: column; overflow: auto;">
  <img src="large-image.png"
       style="max-width: 100%; max-height: 100%; min-height: 0; flex-shrink: 1; object-fit: contain;" />
  <p>Some text</p>
</div>
```

### Tailwind 写法

```tsx
<div className="h-[200px] flex flex-col overflow-auto">
  <img src="large-image.png" className="max-w-full max-h-full min-h-0 shrink object-contain" />
  <p>Some text</p>
</div>
```

### Canvas 同理

```tsx
<div className="h-[200px] flex flex-col overflow-auto">
  <canvas className="max-w-full max-h-full min-h-0 shrink object-contain" />
</div>
```

## 何时需要

- Flex 列布局中图片/canvas 需要自适应高度时
- Modal 内容区高度受限，子元素需要等比缩放时
- 任何 `max-height` / `max-width` 不生效的 flex 子项

## 常见陷阱

| 写法 | 结果 |
|---|---|
| `max-h-full` 单独用 | 在 `overflow: auto` 容器里无效，父级高度由内容撑开 |
| `max-h-full` + `min-h-0` | ✅ 父级有固定高度时生效 |
| `h-auto` 用于 canvas | canvas 有固有高度，`h-auto` 等于固有高度，不起作用 |
