import { useState, useCallback, useRef, useEffect } from "react";

export interface UseLocalStorageOptions<T> {
  /** 默认值（key 不存在时使用） */
  defaultValue?: T | (() => T);
  /** 自定义序列化，默认 JSON.stringify */
  serializer?: (value: T) => string;
  /** 自定义反序列化，默认 JSON.parse */
  deserializer?: (raw: string) => T;
}

function getStoredValue<T>(
  key: string,
  defaultValue: T | (() => T) | undefined,
  deserializer: (raw: string) => T,
): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      return deserializer(raw);
    }
  } catch { /* ignore */ }
  return defaultValue instanceof Function ? defaultValue() : defaultValue;
}

/**
 * localStorage 持久化状态 hook，API 对齐 ahooks/useLocalStorageState。
 *
 * - 自动序列化/反序列化（默认 JSON）
 * - 支持跨标签页同步（storage event）
 * - setState 支持函数式更新
 * - setState(undefined) 或 remove() 删除 key
 */
export function useLocalStorage<T>(
  key: string,
  options: UseLocalStorageOptions<T> = {},
) {
  const {
    defaultValue,
    serializer = JSON.stringify,
    deserializer = JSON.parse,
  } = options;

  const deserializerRef = useRef(deserializer);
  deserializerRef.current = deserializer;

  const [state, setState] = useState<T | undefined>(() =>
    getStoredValue(key, defaultValue, deserializer),
  );

  // 写入 localStorage
  const updateStorage = useCallback(
    (value: T | undefined) => {
      try {
        if (value === undefined) {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, serializer(value));
        }
      } catch { /* quota exceeded, etc. */ }
    },
    [key, serializer],
  );

  // 对外暴露的 setState，支持函数式更新
  const set = useCallback(
    (value: T | undefined | ((prev: T | undefined) => T | undefined)) => {
      setState((prev) => {
        const next = value instanceof Function ? value(prev) : value;
        updateStorage(next);
        return next;
      });
    },
    [updateStorage],
  );

  // 删除 key
  const remove = useCallback(() => {
    setState(undefined);
    try {
      localStorage.removeItem(key);
    } catch { /* ignore */ }
  }, [key]);

  // 跨标签页同步
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== key) return;
      if (e.newValue === null) {
        setState(defaultValue instanceof Function ? defaultValue() : defaultValue);
      } else {
        try {
          setState(deserializerRef.current(e.newValue));
        } catch { /* ignore */ }
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [key, defaultValue]);

  return [state, set, remove] as const;
}
