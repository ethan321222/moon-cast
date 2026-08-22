import { useSyncExternalStore } from "react";

export type PointerType = "coarse" | "fine";

const query = "(pointer: coarse)";

function getSnapshot(): PointerType {
  if (typeof window === "undefined") return "fine";
  return window.matchMedia(query).matches ? "coarse" : "fine";
}

function subscribe(cb: () => void): () => void {
  const mq = window.matchMedia(query);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * 检测主输入设备是粗指针（触屏）还是精确指针（鼠标/笔）
 *
 * - `'coarse'` → 触屏设备，应使用底部操作面板等大触控区域交互
 * - `'fine'` → 鼠标/笔设备，可使用悬浮菜单等精确交互
 */
export function usePointerType(): PointerType {
  return useSyncExternalStore(subscribe, getSnapshot, () => "fine" as PointerType);
}
