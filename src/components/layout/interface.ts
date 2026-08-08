import type { ReactNode, HTMLAttributes } from "react";

export interface LayoutProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  /** 是否包含 Sider，自动设置 has-sider 样式 */
  hasSider?: boolean;
}

export interface SiderProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
  /** 宽度，支持数字(px)或字符串，如 "25%" */
  width?: number | string;
  /** 折叠后宽度 */
  collapsedWidth?: number | string;
  /** 是否可折叠 */
  collapsible?: boolean;
  /** 是否折叠（受控） */
  collapsed?: boolean;
  /** 默认是否折叠（非受控） */
  defaultCollapsed?: boolean;
  /** 折叠状态变化回调 */
  onCollapse?: (collapsed: boolean) => void;
  /** 主题 */
  theme?: "light" | "dark";
}
