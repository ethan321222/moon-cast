import { useRef, useCallback, useEffect } from "react";

export interface UseLongPressOptions {
  /** 长按触发回调 */
  onLongPress: (e: React.PointerEvent) => void;
  /** 短按回调（长按触发后不会调用） */
  onClick?: (e: React.MouseEvent) => void;
  /** 右键菜单回调（触摸设备上自动 preventDefault 后调用） */
  onContextMenu?: (e: React.MouseEvent) => void;
  /** 触发延迟（ms），默认 500 */
  delay?: number;
  /** 移动取消阈值（px），默认 10 */
  threshold?: number;
  /** 禁用 */
  disabled?: boolean;
}

export interface UseLongPressReturn {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
}

/**
 * 检测长按手势，兼容触摸 / 鼠标 / 笔
 *
 * 用法：
 * ```tsx
 * const handlers = useLongPress({ onLongPress: (e) => ... });
 * <div {...handlers}>长按我</div>
 * ```
 */
export function useLongPress({
  onLongPress,
  onClick,
  onContextMenu,
  delay = 500,
  threshold = 10,
  disabled = false,
}: UseLongPressOptions): UseLongPressReturn {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const firedRef = useRef(false);
  const pointerTypeRef = useRef<string>("");

  // 清除定时器
  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // unmount 时清理
  useEffect(() => clear, [clear]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      // 只响应主按键（左键 / 单指触摸）
      if (e.button !== 0) return;
      firedRef.current = false;
      pointerTypeRef.current = e.pointerType;
      startPos.current = { x: e.clientX, y: e.clientY };
      clear();
      timerRef.current = setTimeout(() => {
        firedRef.current = true;
        onLongPress(e);
      }, delay);
    },
    [disabled, delay, onLongPress, clear],
  );

  const onPointerUp = useCallback(() => {
    clear();
  }, [clear]);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (timerRef.current === null) return;
      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;
      if (dx * dx + dy * dy > threshold * threshold) {
        clear();
      }
    },
    [threshold, clear],
  );

  const onPointerCancel = useCallback(() => {
    clear();
  }, [clear]);

  // 触摸设备上长按触发后 suppress 原生 contextmenu，然后调用传入的 handler
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (pointerTypeRef.current === "touch" || firedRef.current) {
        e.preventDefault();
      }
      onContextMenu?.(e);
    },
    [onContextMenu],
  );

  // 长按触发后吞掉 click，否则调用传入的 onClick
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (firedRef.current) {
        e.preventDefault();
        e.stopPropagation();
        firedRef.current = false;
      } else {
        onClick?.(e);
      }
    },
    [onClick],
  );

  return { onPointerDown, onPointerUp, onPointerMove, onPointerCancel, onContextMenu: handleContextMenu, onClick: handleClick };
}
