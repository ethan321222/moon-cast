import type { ListItemProps, ListItemMetaProps } from "./interface";
import styles from "./List.module.css";

export function ListItem({
  actions,
  extra,
  className,
  style,
  children,
  onClick,
  onContextMenu,
}: ListItemProps) {
  return (
    <div
      className={`${styles.item}${className ? ` ${className}` : ""}`}
      style={style}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <div className={styles.itemMain}>
        {children}
        {actions && actions.length > 0 && (
          <ul className={styles.itemActions}>
            {actions.map((action, i) => (
              <li key={i}>{action}</li>
            ))}
          </ul>
        )}
      </div>
      {extra && <div className={styles.itemExtra}>{extra}</div>}
    </div>
  );
}

export function ListItemMeta({
  avatar,
  title,
  description,
  className,
  style,
}: ListItemMetaProps) {
  return (
    <div className={`${styles.meta}${className ? ` ${className}` : ""}`} style={style}>
      {avatar && <div className={styles.metaAvatar}>{avatar}</div>}
      {(title || description) && (
        <div className={styles.metaContent}>
          {title && <div className={styles.metaTitle}>{title}</div>}
          {description && <div className={styles.metaDescription}>{description}</div>}
        </div>
      )}
    </div>
  );
}

ListItem.Meta = ListItemMeta;
