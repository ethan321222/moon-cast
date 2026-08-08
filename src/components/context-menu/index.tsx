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
  /** 子元素（右键触发目标） */
  children: ReactElement<{ onContextMenu?: (e: React.MouseEvent) => void }>;
  /** 自定义类名 */
  className?: string;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * 通用右键菜单组件
 *
 * 用法：
 * ```tsx
 * <ContextMenu items={[...]} onClick={(key) => {}}>
 *   <div>右键点击我</div>
 * </ContextMenu>
 * ```
 */
export function ContextMenu({ items, onClick, children, className, disabled }: ContextMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  // 关闭菜单
  const close = useCallback(() => setOpen(false), []);

  // 处理右键事件
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

  // 全局 mousedown 关闭（点击菜单外部）
  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open, close]);

  // Escape 键关闭
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, close]);

  // 滚动时关闭
  useEffect(() => {
    if (!open) return;
    const handleScroll = () => close();
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [open, close]);

  // 视口边界调整
  const getAdjustedPosition = useCallback(() => {
    if (!menuRef.current) return { left: position.x, top: position.y };
    const rect = menuRef.current.getBoundingClientRect();
    let { x: left, y: top } = position;

    // 右边界翻转
    if (left + rect.width > window.innerWidth) {
      left = left - rect.width;
    }
    // 下边界翻转
    if (top + rect.height > window.innerHeight) {
      top = top - rect.height;
    }
    // 确保不超出左/上边界
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

  // cloneElement 注入 onContextMenu，不加额外包裹层
  const triggerNode = cloneElement(children, {
    onContextMenu: (e: React.MouseEvent) => {
      handleContextMenu(e);
      // 保留子元素原有的 onContextMenu
      children.props.onContextMenu?.(e);
    },
  });

  // 菜单渲染（Portal 到 body）
  const menu = open
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
    </>
  );
}

/* ========== 内部菜单弹出层 ========== */

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
