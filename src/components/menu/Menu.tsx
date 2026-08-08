import { useState, useMemo } from "react";
import type { Key } from "react";
import type { MenuProps, ItemType } from "./interface";
import styles from "./Menu.module.css";

function clsx(...args: (string | false | null | undefined)[]) {
  return args.filter(Boolean).join(" ");
}

export function Menu(props: MenuProps) {
  const {
    items = [],
    selectedKeys: controlledSelectedKeys,
    defaultSelectedKeys = [],
    onClick,
    className,
  } = props;

  const [innerSelectedKeys, setInnerSelectedKeys] = useState<Key[]>(defaultSelectedKeys);

  const mergedSelectedKeys = controlledSelectedKeys ?? innerSelectedKeys;
  const selectedSet = useMemo(() => new Set(mergedSelectedKeys), [mergedSelectedKeys]);

  const handleClick = (item: ItemType) => {
    if (!item || item.disabled) return;
    const info = { key: item.key, keyPath: [item.key] };
    setInnerSelectedKeys([item.key]);
    onClick?.(info);
  };

  return (
    <nav className={clsx(styles.menu, className)}>
      {items.filter(Boolean).map((item) => {
        if (!item) return null;
        if (item.type === "divider") {
          return <div key={`divider-${item.key}`} className={styles.divider} />;
        }
        const isSelected = selectedSet.has(item.key);
        return (
          <button
            key={item.key}
            className={clsx(styles.item, isSelected && styles.itemActive)}
            disabled={item.disabled}
            onClick={() => handleClick(item)}
          >
            {item.icon && <span className={styles.icon}>{item.icon}</span>}
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
