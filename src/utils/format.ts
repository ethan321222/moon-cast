const UNITS = ["B", "KB", "MB", "GB", "TB"];

/**
 * 格式化字节数为人类可读的大小
 */
export function formatSize(bytes: number): string {
  if (bytes === 0) return "-";
  let size = bytes;
  let unitIdx = 0;
  while (size >= 1024 && unitIdx < UNITS.length - 1) {
    size /= 1024;
    unitIdx++;
  }
  if (unitIdx === 0) return `${bytes} ${UNITS[0]}`;
  return `${size.toFixed(1)} ${UNITS[unitIdx]}`;
}

/**
 * 格式化 Unix 时间戳为本地日期时间字符串
 */
export function formatDate(timestamp: number): string {
  if (timestamp === 0) return "";
  const date = new Date(timestamp * 1000);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}
