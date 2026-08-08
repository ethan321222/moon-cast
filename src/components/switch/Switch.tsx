import { useState, useCallback, forwardRef } from "react";
import type { ReactNode, CSSProperties, ButtonHTMLAttributes } from "react";
import styles from "./Switch.module.css";

export type SwitchSize = "small" | "medium";

export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "type"> {
  /** 受控模式：是否选中 */
  checked?: boolean;
  /** 非受控模式：默认是否选中 */
  defaultChecked?: boolean;
  /** 状态变化回调 */
  onChange?: (checked: boolean) => void;
  /** 禁用 */
  disabled?: boolean;
  /** 加载中（自动禁用） */
  loading?: boolean;
  /** 尺寸 */
  size?: SwitchSize;
  /** 选中时内容 */
  checkedChildren?: ReactNode;
  /** 未选中时内容 */
  unCheckedChildren?: ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 内联样式 */
  style?: CSSProperties;
}

const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      checked: controlledChecked,
      defaultChecked = false,
      onChange,
      disabled = false,
      loading = false,
      size = "medium",
      checkedChildren,
      unCheckedChildren,
      className,
      style,
      ...rest
    },
    ref
  ) => {
    const isControlled = controlledChecked !== undefined;
    const [internalChecked, setInternalChecked] = useState(defaultChecked);
    const checked = isControlled ? controlledChecked : internalChecked;

    const handleClick = useCallback(
      (_e: React.MouseEvent<HTMLButtonElement>) => {
        if (disabled || loading) return;

        const next = !checked;
        if (!isControlled) {
          setInternalChecked(next);
        }
        onChange?.(next);
      },
      [checked, disabled, loading, isControlled, onChange]
    );

    const cls = [
      styles.switch,
      checked && styles.checked,
      disabled && styles.disabled,
      loading && styles.loading,
      size === "small" && styles.small,
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-disabled={disabled || loading}
        className={cls}
        style={style}
        onClick={handleClick}
        {...rest}
      >
        <span className={styles.inner}>
          <span className={styles.innerChecked}>{checkedChildren}</span>
          <span className={styles.innerUnchecked}>{unCheckedChildren}</span>
        </span>
        <span className={styles.handle}>
          {loading && <span className={styles.loadingIcon} />}
        </span>
      </button>
    );
  }
);

Switch.displayName = "Switch";

export default Switch;
