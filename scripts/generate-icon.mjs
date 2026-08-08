/**
 * 生成 moon-cast 应用图标（月亮渐变圆形）
 * 运行: node scripts/generate-icon.mjs
 * 输出: src-tauri/icons/icon.png (1024x1024)
 * 然后: npx tauri icon src-tauri/icons/icon.png
 */

import { createCanvas } from "@napi-rs/canvas";
import { writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const size = 1024;
const canvas = createCanvas(size, size);
const ctx = canvas.getContext("2d");

// 透明背景
ctx.clearRect(0, 0, size, size);

// 圆形裁剪
ctx.beginPath();
ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
ctx.closePath();
ctx.clip();

// 径向渐变（与 CSS 一致）
// background: radial-gradient(circle at 35% 30%, #fff5d6, #f5a623 55%, #b88a2e)
const gradient = ctx.createRadialGradient(
  size * 0.35, size * 0.30, 0,       // 中心点 (35%, 30%)
  size * 0.35, size * 0.30, size * 0.7 // 半径覆盖整圆
);
gradient.addColorStop(0, "#fff5d6");
gradient.addColorStop(0.55, "#f5a623");
gradient.addColorStop(1, "#b88a2e");

ctx.fillStyle = gradient;
ctx.fillRect(0, 0, size, size);

// 添加一层柔和的内阴影效果，增加立体感
const shadowGradient = ctx.createRadialGradient(
  size * 0.5, size * 0.5, size * 0.35,
  size * 0.5, size * 0.5, size * 0.5
);
shadowGradient.addColorStop(0, "rgba(0,0,0,0)");
shadowGradient.addColorStop(1, "rgba(0,0,0,0.15)");
ctx.fillStyle = shadowGradient;
ctx.fillRect(0, 0, size, size);

// 保存
const outPath = resolve(__dirname, "../src-tauri/icons/icon.png");
mkdirSync(dirname(outPath), { recursive: true });
const buffer = canvas.toBuffer("image/png");
writeFileSync(outPath, buffer);

console.log(`✓ 图标已生成: ${outPath} (${size}x${size})`);
console.log(`\n下一步运行:\n  npx tauri icon src-tauri/icons/icon.png`);
