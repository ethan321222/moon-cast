import type { ReactNode, CSSProperties } from "react";

export interface CardProps {
  /** 标题 */
  title?: ReactNode;
  /** 描述 */
  description?: ReactNode;
  /** 内容 */
  children?: ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: CSSProperties;
}

export function Card({
  title,
  description,
  children,
  className,
  style,
}: CardProps) {
  return (
    <div
      className={[
        "card bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-xl shadow-[var(--shadow-sm)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
    >
      {(title || description) && (
        <div className="card-head px-4 pt-4 pb-2">
          {title && (
            <span className="card-title text-sm font-semibold tracking-tight">
              {title}
            </span>
          )}
          {description && (
            <div className="card-desc text-xs text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">
              {description}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
