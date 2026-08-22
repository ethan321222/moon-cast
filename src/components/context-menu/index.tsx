import {
  useState,
  useEffect,
  useCallback,
  useRef,
  cloneElement,
  forwardRef,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useLongPress } from "@/hooks/useLongPress";
import { usePointerType } from "@/hooks/usePointerType";
import { ActionSheet } from "@/components/action-sheet";

export interface ContextMenuItem {
  key: string;
  label: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}

export interface ContextMenuProps {
  /** 菜单项 */
  items: ContextMenuItem[];
  /** 点击菜单项回调 */
  onClick: (key: string) => void;
  /** 子元素（右键 / 长按触发目标） */
  children: ReactElement<Record<string, unknown>>;
  /** 自定义类名 */
  className?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** ActionSheet 标题（移动端显示） */
  title?: ReactNode;
}

/**
 * 通用右键菜单组件（响应式）
 *
 * - 桌面（fine pointer）：右键弹出浮动菜单
 * - 移动（coarse pointer）：长按弹出底部 ActionSheet
 */
export function ContextMenu({ items, onClick, children, className, disabled, title }: ContextMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const pointerType = usePointerType();

  // 关闭菜单
  const close = useCallback(() => setOpen(false), []);

  // 处理右键事件（桌面）
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      setPosition({ x: e.clientX, y: e.clientY });
      setOpen(true);
    },
    [disabled],
  );

  // 统一手势管理：
  // - onLongPress: 移动端长按打开菜单
  // - onClick: 接管子元素点击，长按后不触发
  // - onContextMenu: 桌面端右键打开菜单，移动端仅 suppress 原生菜单
  const longPressHandlers = useLongPress({
    onLongPress: (e) => {
      setPosition({ x: e.clientX, y: e.clientY });
      setOpen(true);
    },
    onClick: (children.props as { onClick?: (e: React.MouseEvent) => void }).onClick,
    onContextMenu: (e: React.MouseEvent) => {
      if (pointerType === "fine") {
        handleContextMenu(e);
      }
      (children.props as { onContextMenu?: (e: React.MouseEvent) => void }).onContextMenu?.(e);
    },
    disabled,
  });

  // 全局 mousedown 关闭（点击菜单外部）—— 仅桌面浮动菜单需要
  useEffect(() => {
    if (!open || pointerType === "coarse") return;
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open, close, pointerType]);

  // Escape 键关闭
  useEffect(() => {
    if (!open || pointerType === "coarse") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, close, pointerType]);

  // 滚动时关闭
  useEffect(() => {
    if (!open || pointerType === "coarse") return;
    const handleScroll = () => close();
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [open, close, pointerType]);

  // 视口边界调整
  const getAdjustedPosition = useCallback(() => {
    if (!menuRef.current) return { left: position.x, top: position.y };
    const rect = menuRef.current.getBoundingClientRect();
    let { x: left, y: top } = position;

    if (left + rect.width > window.innerWidth) {
      left = left - rect.width;
    }
    if (top + rect.height > window.innerHeight) {
      top = top - rect.height;
    }
    left = Math.max(0, left);
    top = Math.max(0, top);

    return { left, top };
  }, [position]);

  // 点击菜单项
  const handleItemClick = useCallback(
    (key: string, itemDisabled?: boolean) => {
      if (itemDisabled) return;
      close();
      onClick(key);
    },
    [onClick, close],
  );

  // cloneElement 注入所有事件（由 hook 统一管理）
  const triggerNode = cloneElement(children, {
    ...longPressHandlers,
  });

  // 渲染
  const menu =
    open && pointerType === "fine"
      ? createPortal(
          <MenuPopup
            ref={menuRef}
            items={items}
            position={getAdjustedPosition()}
            className={className}
            onItemClick={handleItemClick}
          />,
          document.body,
        )
      : null;

  return (
    <>
      {triggerNode}
      {menu}
      {pointerType === "coarse" && (
        <ActionSheet
          open={open}
          items={items}
          onClick={(key) => handleItemClick(key)}
          onClose={close}
          title={title}
        />
      )}
    </>
  );
}

/* ========== 内部菜单弹出层（桌面） ========== */

interface MenuPopupProps {
  items: ContextMenuItem[];
  position: { left: number; top: number };
  className?: string;
  onItemClick: (key: string, disabled?: boolean) => void;
}

const MenuPopup = forwardRef<HTMLDivElement, MenuPopupProps>(
  ({ items, position, className, onItemClick }, ref) => {
    const cls = [
      "fixed z-[9999] min-w-[120px] py-1 rounded-lg",
      "bg-[var(--color-bg-elevated)] border border-[var(--color-border)]",
      "shadow-lg animate-[contextMenuIn_0.12s_ease-out]",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div
        ref={ref}
        className={cls}
        style={{ left: position.left, top: position.top }}
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((item) => (
          <div
            key={item.key}
            className={[
              "flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer transition-colors",
              "hover:bg-[var(--color-bg-hover)]",
              item.danger ? "text-[var(--color-danger)]" : "text-[var(--color-text)]",
              item.disabled ? "opacity-40 cursor-not-allowed" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onItemClick(item.key, item.disabled)}
          >
            {item.icon && <span className="w-4 h-4 flex items-center justify-center">{item.icon}</span>}
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    );
  },
);

MenuPopup.displayName = "MenuPopup";
