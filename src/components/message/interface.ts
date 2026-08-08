import type React from "react";

export type MessageType = "success" | "error" | "info" | "warning";

export interface MessageItem {
  id: number;
  content: React.ReactNode;
  type: MessageType;
}

export interface MessageConfig {
  duration?: number;
  maxCount?: number;
}

export interface MessageInstance {
  success: (content: React.ReactNode, duration?: number) => void;
  error: (content: React.ReactNode, duration?: number) => void;
  info: (content: React.ReactNode, duration?: number) => void;
  warning: (content: React.ReactNode, duration?: number) => void;
  destroy: () => void;
}
