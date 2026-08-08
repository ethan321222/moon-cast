import { useCallback, useSyncExternalStore } from "react";

export type ThemeSetting = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "mooncast-theme";

function systemPrefersDark() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

function resolve(setting: ThemeSetting): ResolvedTheme {
  if (setting === "system") return systemPrefersDark() ? "dark" : "light";
  return setting;
}

function getSnapshot(): ResolvedTheme {
  if (typeof document === "undefined") return systemPrefersDark() ? "dark" : "light";
  return (document.documentElement.getAttribute("data-theme") as ResolvedTheme) || (systemPrefersDark() ? "dark" : "light");
}

function subscribe(cb: () => void): () => void {
  // 同一标签页内通过自定义事件同步
  window.addEventListener("theme-change", cb);
  // system 模式下监听系统偏好变化
  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  mq?.addEventListener("change", cb);
  return () => {
    window.removeEventListener("theme-change", cb);
    mq?.removeEventListener("change", cb);
  };
}

function applyTheme(setting: ThemeSetting) {
  const resolved = resolve(setting);
  document.documentElement.setAttribute("data-theme", resolved);
  try {
    localStorage.setItem(STORAGE_KEY, setting);
  } catch {}
  window.dispatchEvent(new Event("theme-change"));
}

/** 从 localStorage 初始化，在 App 顶层调用一次 */
export function initTheme() {
  const saved = (localStorage.getItem(STORAGE_KEY) as ThemeSetting) || "system";
  applyTheme(saved);
}

/** 读写 + 切换主题，任意组件可调用，跨组件自动同步 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot);
  const setting = (localStorage.getItem(STORAGE_KEY) as ThemeSetting) || "system";

  const setTheme = useCallback((t: ThemeSetting) => applyTheme(t), []);

  const toggleTheme = useCallback(() => {
    applyTheme(theme === "dark" ? "light" : "dark");
  }, [theme]);

  return { theme, setting, setTheme, toggleTheme };
}
