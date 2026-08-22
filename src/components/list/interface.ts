import type React from "react";

export interface ListGridType {
  column?: number;
  gutter?: number;
}

export interface ListProps<T = any> {
  dataSource?: T[];
  renderItem?: (item: T, index: number) => React.ReactNode;
  grid?: ListGridType;
  loading?: boolean;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  split?: boolean;
  size?: "small" | "default" | "large";
  locale?: { emptyText?: React.ReactNode };
  rowKey?: ((item: T) => React.Key) | keyof T;
  className?: string;
  style?: React.CSSProperties;
}

export interface ListItemProps extends React.HTMLAttributes<HTMLDivElement> {
  actions?: React.ReactNode[];
  extra?: React.ReactNode;
}

export interface ListItemMetaProps {
  avatar?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}
