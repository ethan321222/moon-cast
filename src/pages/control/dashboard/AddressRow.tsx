import { useCallback, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/button";

export interface AddressRowProps {
  /** 前置图标 */
  icon: ReactNode;
  /** 名称，如"本机"、"局域网"、"公网" */
  name: string;
  /** 完整地址 URL */
  address: string | null;
  /** 行状态 */
  status: "loading" | "ready" | "error";
  /** loading 状态下的自定义文案，如 "正在下载 cloudflared..." */
  statusText?: string;
  /** 错误信息 */
  error?: string | null;
  /** 显示二维码回调 */
  onShowQr: (url: string) => void;
}

export function AddressRow({ icon, name, address, status, statusText, error, onShowQr }: AddressRowProps) {
  const { t } = useTranslation("control");
  const [copied, setCopied] = useState(false);
  const disabled = status !== "ready" || !address;

  const copyToClipboard = useCallback(() => {
    if (!address) return;
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }).catch(() => {});
  }, [address]);

  const openInBrowser = useCallback(() => {
    if (!address) return;
    import("@tauri-apps/plugin-opener").then((mod) => mod.openUrl(address)).catch(() => {
      window.open(address, "_blank");
    });
  }, [address]);

  return (
    <div className="flex items-center gap-2.5 px-4 py-2 border-t border-[var(--color-border)] transition-colors hover:bg-[var(--color-bg-hover)]">
      <span className="shrink-0 w-5 h-5 grid place-items-center text-[var(--color-text)]">{icon}</span>
      <span className="text-xs font-medium text-[var(--color-text)] shrink-0 min-w-[36px] leading-none">{t(`address.${name}`, name)}</span>

      {status === "loading" && (
        <span className="flex-1 min-w-0 text-xs text-[var(--color-text-muted)] animate-pulse">{statusText ? t(`address.status.${statusText}`, statusText) : t("address.connecting")}</span>
      )}
      {status === "error" && (
        <span className="flex-1 min-w-0 text-xs text-[var(--color-danger)] overflow-hidden text-ellipsis whitespace-nowrap">
          {error || t("address.connectFailed")}
        </span>
      )}
      {status === "ready" && (
        <span className="flex-1 min-w-0 font-['Microsoft_YaHei','Segoe_UI',sans-serif] text-xs text-[var(--color-text-secondary)] overflow-hidden text-ellipsis whitespace-nowrap">
          {address}
        </span>
      )}

      <div className="flex items-center gap-0.5 shrink-0">
        <Button
          type="text"
          size="small"
          disabled={disabled}
          className={copied ? "text-[var(--color-success)]" : undefined}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>}
          onClick={copyToClipboard}
          title={t("address.copy")}
        />
        <Button
          type="text"
          size="small"
          disabled={disabled}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>}
          onClick={openInBrowser}
          title={t("address.open")}
        />
        <Button
          type="text"
          size="small"
          disabled={disabled}
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="8" height="8" rx="1" /><rect x="14" y="2" width="8" height="8" rx="1" /><rect x="2" y="14" width="8" height="8" rx="1" /><rect x="14" y="14" width="4" height="4" /><rect x="20" y="20" width="2" height="2" /><rect x="14" y="20" width="2" height="2" /><rect x="20" y="14" width="2" height="2" /></svg>}
          onClick={() => address && onShowQr(address)}
          title={t("address.qr")}
        />
      </div>
    </div>
  );
}
