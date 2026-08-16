import { useEffect, useCallback, type CSSProperties, type ReactNode, forwardRef } from "react";
import styles from "./Modal.module.css";

export interface ModalProps {
  /** 是否可见 */
  open?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
  /** 标题 */
  title?: ReactNode;
  /** 内容 */
  children?: ReactNode;
  /** 点击遮罩关闭，默认 true */
  maskClosable?: boolean;
  /** Esc 键关闭，默认 true */
  keyboard?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 宽度，默认 420 */
  width?: number | string;
  /** 垂直居中，默认 true；false 时居上显示 */
  centered?: boolean;
}

const Modal = forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      open,
      onClose,
      title,
      children,
      maskClosable = true,
      keyboard = true,
      className,
      width = 420,
      centered = true,
    },
    ref,
  ) => {
    // Esc 关闭
    useEffect(() => {
      if (!open || !keyboard) return;
      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose?.();
      };
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }, [open, keyboard, onClose]);

    const handleMaskClick = useCallback(
      (e: React.MouseEvent) => {
        if (maskClosable && e.target === e.currentTarget) {
          onClose?.();
        }
      },
      [maskClosable, onClose],
    );

    if (!open) return null;

    const maskCls = [styles.mask, !centered && styles.maskTop].filter(Boolean).join(" ");
    const cls = [styles.modal, className].filter(Boolean).join(" ");
    const modalStyle = {
      "--modal-width": typeof width === "number" ? `${width}px` : width,
    } as CSSProperties;

    return (
      <div className={maskCls} onClick={handleMaskClick}>
        <div
          ref={ref}
          className={cls}
          style={modalStyle}
        >
          {title && (
            <div className={styles.header}>
              <div className={styles.title}>{title}</div>
              <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
                ✕
              </button>
            </div>
          )}
          <div className={styles.body}>{children}</div>
        </div>
      </div>
    );
  },
);

Modal.displayName = "Modal";

export default Modal;
