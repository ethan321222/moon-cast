// 目录条目
export interface DirEntry {
  name: string;
  rel_path: string;
  is_dir: boolean;
  size: number;
  created_ts: number;
  modified_ts: number;
  media_type: string;
}

// 目录列表
export interface DirListing {
  path: string;
  entries: DirEntry[];
}

// 目录响应（包含服务器能力）
export interface DirResponse extends DirListing {
  webdav: boolean;
  webdav_auth: boolean;
}

// 服务器配置
export interface ServerConfig {
  root: string;
  bind: string;
  port: number;
  show_hidden: boolean;
  max_depth: number;
  speed_limit: number | null;
  webdav: boolean;
  auth_enabled: boolean;
  auth_user: string | null;
  auth_pass: string | null;
  tunnel_enabled: boolean;
  tunnel_bin: string | null;
}

// 隧道状态
export interface TunnelStatus {
  running: boolean;
  public_url: string | null;
  kind: "cloudflare";
}

// cloudflared 可用性
export interface BinaryStatus {
  available: boolean;
  path: string | null;
}

// 地址条目（由后端 address-ready 事件推送）
export interface AddressEntry {
  id: string;
  kind: "local" | "lan" | "tunnel";
  status: "loading" | "ready" | "error";
  statusText?: string;
  name: string;
  url: string | null;
  error: string | null;
}

// 服务器状态
export interface ServerStatus {
  running: boolean;
  local_addr: string | null;
  root: string;
  port: number;
}

// 局域网地址
export interface LanAddress {
  ip: string;
  port: number;
  url: string;
}

// 排序字段
export type SortField = "name" | "size" | "created" | "modified";

// 排序方向
export type SortDirection = "asc" | "desc";

// 视图模式
export type ViewMode = "detail" | "grid";

// 颜色模式
export type ColorMode = "light" | "dark";
