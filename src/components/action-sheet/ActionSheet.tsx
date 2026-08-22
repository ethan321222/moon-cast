import { useEffect, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./ActionSheet.module.css";

export interface ActionSheetItem {
  key: string;
  label: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
}

export interface ActionSheetProps {
  /** 是否可见 */
  open: boolean;
  /** 操作项 */
  items: ActionSheetItem[];
  /** 关闭回调 */
  onClose: () => void;
  /** 点击项回调 */
  onClick: (key: string) => void;
  /** 标题（可选） */
  title?: ReactNode;
  /** 取消按钮文案 */
  cancelText?: ReactNode;
}

/**
 * 底部操作面板 —— 移动端友好的操作菜单
 *
 * 用法：
 * ```tsx
 * <ActionSheet
 *   open={visible}
 *   items={[{ key: "delete", label: "删除", danger: true }]}
 *   onClick={(key) => handleAction(key)}
 *   onClose={() => setVisible(false)}
 * />
 * ```
 */
export function ActionSheet({
  open,
  items,
  onClose,
  onClick,
  title,
  cancelText = "取消",
}: ActionSheetProps) {
  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleItemClick = useCallback(
    (key: string, disabled?: boolean) => {
      if (disabled) return;
      onClose();
      onClick(key);
    },
    [onClick, onClose],
  );

  if (!open) return null;

  return createPortal(
    <>
      <div className={styles.mask} onClick={onClose} />
      <div className={styles.sheet}>
        <div className={styles.handle} />
        {title && <div className={styles.title}>{title}</div>}
        {items.map((item) => {
          const cls = [
            styles.item,
            item.danger ? styles.itemDanger : "",
            item.disabled ? styles.itemDisabled : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div key={item.key} className={cls} onClick={() => handleItemClick(item.key, item.disabled)}>
              {item.icon && <span>{item.icon}</span>}
              <span>{item.label}</span>
            </div>
          );
        })}
        <div className={styles.cancel} onClick={onClose}>
          {cancelText}
        </div>
      </div>
    </>,
    document.body,
  );
}
