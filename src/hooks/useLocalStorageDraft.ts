import { useState, useCallback, useMemo } from "react";
import { useLocalStorage, type UseLocalStorageOptions } from "./useLocalStorage";

export interface UseLocalStorageDraftActions {
  /** 将 draft 写入 localStorage */
  save: () => void;
  /** 丢弃草稿，恢复到 localStorage 中已保存的值 */
  reset: () => void;
  /** draft 是否和已保存值不同 */
  isDirty: boolean;
}

/**
 * 持久层 + 编辑草稿分离的 hook。
 *
 * - draft: 当前编辑态（未保存）
 * - setDraft: 修改编辑态，不触发持久化
 * - save(): 将 draft 写入 localStorage
 * - reset(): 丢弃草稿，恢复到已保存值
 * - isDirty: draft 是否和已保存值不同
 */
export function useLocalStorageDraft<T>(
  key: string,
  options: UseLocalStorageOptions<T> = {},
) {
  const [stored, setStored] = useLocalStorage<T>(key, options);

  const fallback = useMemo(
    () => (options.defaultValue instanceof Function ? options.defaultValue() : options.defaultValue),
    // defaultValue 通常是稳定引用，只在挂载时求值
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [draft, setDraft] = useState<T>(() => stored ?? fallback as T);

  const save = useCallback(() => {
    setStored(draft);
  }, [draft, setStored]);

  const reset = useCallback(() => {
    setDraft(stored ?? fallback as T);
  }, [stored, fallback]);

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(stored),
    [draft, stored],
  );

  return [draft, setDraft, { save, reset, isDirty }] as const;
}
