import type { ReactNode, Key } from "react";

export interface MenuItemType {
  key: Key;
  label: ReactNode;
  icon?: ReactNode;
  /** 分割线 */
  type?: "divider";
  disabled?: boolean;
}

export type ItemType = MenuItemType | null;

export interface MenuProps {
  /** 菜单项配置 */
  items?: ItemType[];
  /** 选中的菜单项 key 数组（受控） */
  selectedKeys?: Key[];
  /** 默认选中的菜单项 key（非受控） */
  defaultSelectedKeys?: Key[];
  /** 点击菜单项回调 */
  onClick?: (info: { key: Key; keyPath: Key[] }) => void;
  /** 自定义类名 */
  className?: string;
}
