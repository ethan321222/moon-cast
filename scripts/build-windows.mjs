#!/usr/bin/env node
/**
 * 本地 Windows 构建脚本
 * 模拟 CI 的 release 构建流程，生成：
 *   - MoonCast-{version}-Windows-setup.exe  (NSIS)
 *   - MoonCast-{version}-Windows.msi        (MSI)
 *   - MoonCast-{version}-Windows-Portable.zip (便携版)
 *
 * 用法: node scripts/build-windows.mjs [--version v1.0.2]
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, cpSync, rmSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";

// ---------- 参数解析 ----------
const args = process.argv.slice(2);
let version = "";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--version" && args[i + 1]) {
    version = args[i + 1];
    i++;
  }
}

// ---------- 读取版本号 ----------
if (!version) {
  // 从 package.json 读取
  const pkg = JSON.parse(
    await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../package.json", import.meta.url), "utf-8")
    )
  );
  version = `v${pkg.version}`;
}

const PREFIX = `MoonCast-${version}-Windows`;
const TARGET_DIR = "src-tauri/target/x86_64-pc-windows-msvc/release";
const BUNDLE_DIR = join(TARGET_DIR, "bundle");
const OUTPUT_DIR = "release-assets";

console.log(`\n🚀 MoonCast Windows Build`);
console.log(`   Version: ${version}`);
console.log(`   Output:  ${OUTPUT_DIR}/\n`);

// ---------- Step 1: 构建 ----------
console.log("📦 Step 1: Building Tauri app (release)...\n");
execSync("npx tauri build --target x86_64-pc-windows-msvc", {
  stdio: "inherit",
  cwd: join(import.meta.dirname, ".."),
});

// ---------- Step 2: 准备资源 ----------
console.log("\n📁 Step 2: Preparing release assets...\n");

if (existsSync(OUTPUT_DIR)) {
  rmSync(OUTPUT_DIR, { recursive: true });
}
mkdirSync(OUTPUT_DIR, { recursive: true });

// NSIS installer
const nsisDir = join(BUNDLE_DIR, "nsis");
const nsisExe = existsSync(nsisDir)
  ? readdirSync(nsisDir).find((f) => f.endsWith(".exe"))
  : null;

if (nsisExe) {
  const src = join(nsisDir, nsisExe);
  const dest = join(OUTPUT_DIR, `${PREFIX}-setup.exe`);
  cpSync(src, dest);
  console.log(`  ✅ NSIS:    ${basename(dest)}`);
} else {
  console.error("  ❌ NSIS installer not found!");
  process.exit(1);
}

// MSI installer
const msiDir = join(BUNDLE_DIR, "msi");
const msiFile = existsSync(msiDir)
  ? readdirSync(msiDir).find((f) => f.endsWith(".msi"))
  : null;

if (msiFile) {
  const src = join(msiDir, msiFile);
  const dest = join(OUTPUT_DIR, `${PREFIX}.msi`);
  cpSync(src, dest);
  console.log(`  ✅ MSI:     ${basename(dest)}`);
} else {
  console.error("  ❌ MSI installer not found!");
  process.exit(1);
}

// Portable zip
const portableExe = join(TARGET_DIR, "moon-cast.exe");
if (existsSync(portableExe)) {
  const portableDir = join(OUTPUT_DIR, "_portable_tmp");
  mkdirSync(portableDir, { recursive: true });
  cpSync(portableExe, join(portableDir, "moon-cast.exe"));

  // 使用 PowerShell 压缩（Windows 原生）
  const zipPath = join(OUTPUT_DIR, `${PREFIX}-Portable.zip`);
  execSync(
    `powershell -Command "Compress-Archive -Path '${portableDir}\\*' -DestinationPath '${zipPath}' -Force"`,
    { stdio: "inherit" }
  );
  rmSync(portableDir, { recursive: true });
  console.log(`  ✅ Portable: ${basename(zipPath)}`);
} else {
  console.error("  ❌ Portable exe not found!");
  process.exit(1);
}

// ---------- 完成 ----------
console.log(`\n✨ Done! Assets in ${OUTPUT_DIR}/:\n`);
const files = readdirSync(OUTPUT_DIR);
for (const f of files) {
  const stat = statSync(join(OUTPUT_DIR, f));
  const sizeMB = (stat.size / 1024 / 1024).toFixed(1);
  console.log(`  ${f}  (${sizeMB} MB)`);
}
console.log();
