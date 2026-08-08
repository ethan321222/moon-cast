import type React from "react";

export interface ImageProps {
  src: string;
  alt?: string;
  width?: number | string;
  height?: number | string;
  fallback?: string;
  preview?: boolean | PreviewConfig;
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
}

export interface PreviewConfig {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  src?: string;
}

export interface PreviewGroupProps {
  items?: string[];
  preview?: boolean | GroupPreviewConfig;
  children?: React.ReactNode;
}

export interface GroupPreviewConfig {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  current?: number;
  onChange?: (current: number, prev: number) => void;
  countRender?: (current: number, total: number) => React.ReactNode;
}

export interface PreviewProps {
  open: boolean;
  src: string;
  items?: string[];
  current?: number;
  onClose: () => void;
  onChange?: (current: number, prev: number) => void;
  countRender?: (current: number, total: number) => React.ReactNode;
}
