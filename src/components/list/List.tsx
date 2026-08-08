import type { Key } from "react";
import { useTranslation } from "react-i18next";
import type { ListProps } from "./interface";
import { ListItem, ListItemMeta } from "./Item";
import styles from "./List.module.css";

function getKey<T>(item: T, index: number, rowKey?: ((item: T) => Key) | keyof T): Key {
  if (typeof rowKey === "function") return rowKey(item);
  if (typeof rowKey === "string") return (item as any)[rowKey];
  if ((item as any).key != null) return (item as any).key;
  return index;
}

export function List<T = any>({
  dataSource = [],
  renderItem,
  grid,
  loading = false,
  header,
  footer,
  split = true,
  size = "default",
  locale,
  rowKey,
  className,
  style,
}: ListProps<T>) {
  const { t } = useTranslation("common");
  const cls = [
    styles.list,
    split && styles.split,
    size === "small" && styles.sm,
    size === "large" && styles.lg,
    grid && styles.grid,
    className,
  ].filter(Boolean).join(" ");

  const gridStyle = grid
    ? {
        gridTemplateColumns: `repeat(${grid.column || 3}, 1fr)`,
        gap: `${grid.gutter || 0}px`,
      }
    : undefined;

  const renderContent = () => {
    if (loading) {
      return <div className={styles.loading}>{t("loadingText")}</div>;
    }

    if (dataSource.length === 0) {
      return (
        <div className={styles.empty}>
          {locale?.emptyText ?? t("noData")}
        </div>
      );
    }

    if (!renderItem) return null;

    const items = dataSource.map((item, index) => (
      <div key={getKey(item, index, rowKey)} className={styles.itemWrapper}>
        {renderItem(item, index)}
      </div>
    ));

    if (grid) {
      return (
        <div className={styles.gridContainer} style={gridStyle}>
          {items}
        </div>
      );
    }

    return <div className={styles.items}>{items}</div>;
  };

  return (
    <div className={cls} style={style}>
      {header && <div className={styles.header}>{header}</div>}
      {renderContent()}
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}

List.Item = ListItem;
List.Item.Meta = ListItemMeta;
