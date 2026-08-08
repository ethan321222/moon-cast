import { invoke } from "@tauri-apps/api/core";
import type {
  DirResponse,
  ServerConfig,
  ServerStatus,
  LanAddress,
  TunnelStatus,
  BinaryStatus,
} from "../types";

// ==================== 目录 API ====================

export async function listDirectory(path: string = ""): Promise<DirResponse> {
  const url = path ? `/${path}` : "/";
  const resp = await fetch(url, {
    headers: { "X-Requested-With": "XMLHttpRequest" },
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(err.error || resp.statusText);
  }
  return resp.json();
}

// ==================== 文件操作 API ====================

export async function uploadFile(
  path: string,
  file: File,
  onProgress?: (loaded: number, total: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = path ? `/${path}/${file.name}` : `/${file.name}`;

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(e.loaded, e.total);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(xhr.statusText || "Upload failed"));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Upload failed")));

    xhr.open("PUT", url);
    xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
    xhr.send(file);
  });
}

export async function deletePath(path: string): Promise<void> {
  const resp = await fetch(`/${path}`, {
    method: "DELETE",
    headers: { "X-Requested-With": "XMLHttpRequest" },
  });
  if (!resp.ok && resp.status !== 204) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(err.error || resp.statusText);
  }
}

export async function createDirectory(path: string): Promise<void> {
  const resp = await fetch(`/${path}`, {
    method: "MKCOL",
    headers: { "X-Requested-With": "XMLHttpRequest" },
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(err.error || resp.statusText);
  }
}

export async function renamePath(
  oldPath: string,
  newName: string
): Promise<void> {
  const parent = oldPath.substring(0, oldPath.lastIndexOf("/"));
  const dest = parent
    ? `/${parent.split("/").map(encodeURIComponent).join("/")}/${encodeURIComponent(newName)}`
    : `/${encodeURIComponent(newName)}`;
  const resp = await fetch(`/${oldPath}`, {
    method: "MOVE",
    headers: {
      Destination: dest,
      "X-Requested-With": "XMLHttpRequest",
    },
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(err.error || resp.statusText);
  }
}

export async function movePath(
  srcPath: string,
  destPath: string
): Promise<void> {
  const encodedDest = `/${destPath.split("/").map(encodeURIComponent).join("/")}`;
  const resp = await fetch(`/${srcPath}`, {
    method: "MOVE",
    headers: {
      Destination: encodedDest,
      "X-Requested-With": "XMLHttpRequest",
    },
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(err.error || resp.statusText);
  }
}

// ==================== 系统 API ====================

export async function getDesktopPath(): Promise<string> {
  return invoke("get_desktop_path");
}

export async function getAppDataBinPath(): Promise<string> {
  return invoke("get_app_data_bin_path");
}

// ==================== Tauri IPC API ====================

export async function startServer(config: ServerConfig): Promise<ServerStatus> {
  return invoke("start_server", { config });
}

export async function stopServer(): Promise<void> {
  return invoke("stop_server");
}

export async function getServerStatus(): Promise<boolean> {
  return invoke("get_server_status");
}

export async function getLanAddresses(port: number): Promise<LanAddress[]> {
  return invoke("get_lan_addresses", { port });
}

export async function getLogDirPath(): Promise<string> {
  return invoke("get_log_dir_path");
}

export async function readLogs(): Promise<string[]> {
  return invoke("read_logs");
}

// ==================== Tunnel IPC API ====================

export async function checkTunnelBinary(tunnelBin?: string | null): Promise<BinaryStatus> {
  return invoke("check_tunnel_binary", { tunnelBin: tunnelBin ?? null });
}

export async function downloadTunnelBinary(): Promise<BinaryStatus> {
  return invoke("download_tunnel_binary");
}

export async function startTunnel(port: number, tunnelBin?: string | null): Promise<TunnelStatus> {
  return invoke("start_tunnel", { port, tunnelBin: tunnelBin ?? null });
}

export async function stopTunnel(): Promise<TunnelStatus> {
  return invoke("stop_tunnel");
}

export async function getTunnelStatus(): Promise<TunnelStatus> {
  return invoke("get_tunnel_status");
}

export async function openTunnelConfig(): Promise<string> {
  return invoke("open_tunnel_config");
}
