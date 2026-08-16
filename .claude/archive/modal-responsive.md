# Modal 自适应改造记录

## 背景

Browser 页面里的“新建文件夹”弹窗在手机访问时布局不稳定。根因不在业务弹窗本身，而是通用 `Modal` 对移动端和表单内容的默认约束不够清晰：

- 弹窗宽度由 inline `width` 控制，再用 `max-width: 90vw` 压缩，移动端 padding、地址栏和安全区域变化时不够稳定。
- `.body` 默认 `align-items: center`，适合二维码、图片这类展示内容，但不适合输入框、按钮组等表单内容。
- 小屏下没有统一的遮罩 padding 和 `100dvh` 最大高度约束。

## 设计原则

通用 `Modal` 应该负责“容器自适应”，业务弹窗负责“内容排版”。

- `Modal` 保证不超出屏幕、处理安全区域、处理动态视口高度。
- 表单类内容默认可以撑满弹窗宽度。
- 展示类内容如 QR 码、图片预览，需要在业务组件里显式居中。
- 不在每个业务弹窗里重复写 `max-w-[90vw]`、`mx-auto`、安全区 padding 等容器规则。

## 核心实现

### 1. 宽度用 CSS 变量承接

`Modal.tsx` 不再直接设置 `width`，而是写入 CSS 变量：

```tsx
const modalStyle = {
  "--modal-width": typeof width === "number" ? `${width}px` : width,
} as CSSProperties;

<div className={styles.modal} style={modalStyle}>
  ...
</div>
```

对应 CSS：

```css
.modal {
  width: min(var(--modal-width, 420px), 100%);
  max-width: 100%;
  max-height: calc(100dvh - 32px);
  min-width: 0;
}
```

效果：

- 桌面端按调用方传入的 `width` 显示。
- 手机端自动收缩到遮罩可用宽度。
- `100dvh` 比 `100vh` 更适合移动浏览器地址栏变化。

### 2. 遮罩层负责移动端留白

```css
.mask {
  padding: max(16px, env(safe-area-inset-top))
           max(16px, env(safe-area-inset-right))
           max(16px, env(safe-area-inset-bottom))
           max(16px, env(safe-area-inset-left));
  box-sizing: border-box;
}

@media (max-width: 480px) {
  .mask {
    padding: 12px;
  }
}
```

这样弹窗不会贴边，也兼容刘海屏、安全区域。

### 3. body 默认拉伸

```css
.body {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-width: 0;
}
```

这是对表单场景更好的默认值。输入框、按钮组、警告框等可以自然使用整块弹窗宽度。

如果业务内容需要居中，例如 QR 码，业务组件自己包一层：

```tsx
<Modal width={340}>
  <div className="flex w-full flex-col items-center">
    <canvas className="rounded-lg block max-w-full h-auto object-contain" />
    <div className="mt-3 w-full text-center break-all">{url}</div>
  </div>
</Modal>
```

### 4. 标题和关闭按钮要抗挤压

```css
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  min-width: 0;
}

.title {
  min-width: 0;
  overflow-wrap: anywhere;
}

.close {
  flex-shrink: 0;
}
```

长标题不会把关闭按钮挤出弹窗。

## 使用模式

### 表单弹窗

```tsx
<Modal open={open} onClose={close} title="新建文件夹" width={360} centered={false}>
  <Input value={name} onChange={...} />
  <div className="mt-4 flex w-full flex-wrap items-center justify-end gap-2">
    <Button onClick={close}>取消</Button>
    <Button type="primary" disabled={!name.trim()} onClick={submit}>创建</Button>
  </div>
</Modal>
```

要点：

- 输入框直接放在 body 里即可全宽。
- 按钮组加 `w-full flex-wrap`，小屏不会溢出。
- 主按钮可以根据表单有效性禁用。

### 展示弹窗

```tsx
<Modal open={open} onClose={close} title="二维码" width={340}>
  <div className="flex w-full flex-col items-center">
    <img src={qrUrl} className="block max-w-full h-auto rounded-lg" />
    <div className="mt-3 w-full text-center break-all">{url}</div>
  </div>
</Modal>
```

要点：

- 展示内容要显式 `items-center`。
- 文本 URL 使用 `break-all`，避免长链接撑破布局。

## 常见问题

### 为什么不继续让 `.body` 默认居中？

居中是展示类内容的需求，但 Modal 更多场景是表单、确认、设置项。表单默认应该拉伸，展示内容显式居中更可控。

### 为什么不用 `90vw`？

`90vw` 不知道遮罩 padding 和安全区域，容易和外层留白重复计算。现在的方案是遮罩提供可用空间，弹窗使用 `width: min(target, 100%)` 填入这块空间。

### 为什么用 `100dvh`？

移动浏览器地址栏展开/收起时，`100vh` 可能不等于真实可见高度。`100dvh` 更贴近当前动态视口，弹窗最大高度更稳定。

## 验证清单

- 桌面端 `width={360}`、`width={460}` 保持预期宽度。
- 375px 手机宽度下弹窗不贴边、不横向溢出。
- 顶部弹窗 `centered={false}` 不被状态栏或安全区域遮挡。
- 表单输入框全宽。
- 按钮组可换行。
- QR 码、图片类内容在业务组件内显式居中。
- 长标题和长 URL 不撑破弹窗。

