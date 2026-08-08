/**
 * 从 localStorage 读取值，不存在时返回 fallback
 */
export function getStorage<T extends string>(key: string, fallback: T): T {
  return (localStorage.getItem(key) as T) || fallback;
}

/**
 * 写入 localStorage
 */
export function setStorage(key: string, value: string): void {
  localStorage.setItem(key, value);
}
