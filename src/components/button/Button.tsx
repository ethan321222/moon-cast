import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from "react";
import styles from "./Button.module.css";

export type ButtonType = "default" | "primary" | "dashed" | "text" | "link";
export type ButtonVariant = "outlined" | "dashed" | "solid" | "filled" | "text" | "link";
export type ButtonColor = "default" | "primary" | "danger";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  /** 按钮类型（糖语法，映射到 color + variant） */
  type?: ButtonType;
  /** 按钮颜色 */
  color?: ButtonColor;
  /** 按钮变体 */
  variant?: ButtonVariant;
  /** 危险按钮 */
  danger?: boolean;
  /** 加载状态 */
  loading?: boolean | { delay?: number; icon?: ReactNode };
  /** 按钮尺寸 */
  size?: "small" | "middle" | "large";
  /** 幽灵按钮 */
  ghost?: boolean;
  /** 块级按钮 */
  block?: boolean;
  /** 按钮形状 */
  shape?: "default" | "circle" | "round" | "square";
  /** 图标 */
  icon?: ReactNode;
  /** 图标位置 */
  iconPlacement?: "start" | "end";
  /** 链接地址，设置后渲染为 a 标签 */
  href?: string;
  /** 按钮原生 type 属性 */
  htmlType?: "submit" | "button" | "reset";
  /** 自动插入空色 */
  autoInsertSpace?: boolean;
  children?: ReactNode;
}

/** type → [color, variant] 映射 */
const TYPE_MAP: Record<ButtonType, [ButtonColor, ButtonVariant]> = {
  default: ["default", "outlined"],
  primary: ["primary", "solid"],
  dashed: ["default", "dashed"],
  link: ["default", "link"],
  text: ["default", "text"],
};

const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  (
    {
      type = "default",
      color,
      variant,
      danger,
      loading = false,
      size,
      ghost,
      block,
      shape = "default",
      icon,
      iconPlacement = "start",
      href,
      htmlType = "button",
      className,
      children,
      disabled,
      onClick,
      ...rest
    },
    ref,
  ) => {
    // 解析 color + variant
    const [typeColor, typeVariant] = TYPE_MAP[type];
    const mergedColor = danger ? "danger" : color ?? typeColor;
    const mergedVariant = variant ?? typeVariant;

    const isLoading = typeof loading === "object" ? true : loading;
    const loadingIcon = typeof loading === "object" ? loading.icon : undefined;
    const isIconOnly = icon && !children;

    const cls = [
      styles.btn,
      // variant
      mergedVariant === "solid" && styles.solid,
      mergedVariant === "outlined" && styles.outlined,
      mergedVariant === "dashed" && styles.dashed,
      mergedVariant === "filled" && styles.filled,
      mergedVariant === "text" && styles.text,
      mergedVariant === "link" && styles.link,
      // color
      mergedColor === "primary" && styles.colorPrimary,
      mergedColor === "danger" && styles.colorDanger,
      // other
      ghost && styles.ghost,
      block && styles.block,
      shape === "circle" && styles.circle,
      shape === "round" && styles.round,
      shape === "square" && styles.square,
      size === "small" && styles.sm,
      size === "large" && styles.lg,
      isLoading && styles.loading,
      isIconOnly && styles.iconOnly,
      iconPlacement === "end" && styles.iconEnd,
      className,
    ]
      .filter(Boolean)
      .join(" ");

    const iconNode = isLoading ? (
      <span className={styles.loadingIcon}>{loadingIcon}</span>
    ) : icon ? (
      <span className={styles.icon}>{icon}</span>
    ) : null;

    const contentNode = children != null ? <span>{children}</span> : null;

    const inner = (
      <>
        {iconPlacement === "start" && iconNode}
        {contentNode}
        {iconPlacement === "end" && iconNode}
      </>
    );

    const handleClick = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
      if (isLoading || disabled) {
        e.preventDefault();
        return;
      }
      onClick?.(e as any);
    };

    if (href !== undefined) {
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          className={cls}
          href={disabled ? undefined : href}
          onClick={handleClick}
          {...(rest as any)}
        >
          {inner}
        </a>
      );
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type={htmlType}
        className={cls}
        disabled={disabled || isLoading}
        onClick={handleClick}
        {...rest}
      >
        {inner}
      </button>
    );
  },
);

Button.displayName = "Button";

export default Button;
