import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { ServerConfig } from "../../types";
import { QrModal } from "../../components/modal-qr";
import { Menu } from "../../components/menu";
import type { ItemType } from "../../components/menu";
import { Button } from "../../components/button";
import { useTheme, initTheme } from "../../hooks/useTheme";
import { useLocalStorageDraft } from "../../hooks/useLocalStorageDraft";
import { useServerLifecycle } from "./hooks/useServerLifecycle";
import { Dashboard } from "./dashboard";
import { Setting } from "./setting";
import { getDesktopPath, getAppDataBinPath } from "../../api/client";

type Page = "overview" | "config";

// ---- Icons ----

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.39 5.39 0 0 1-5.4-5.4c0-.46-.04-.92-.1-1.36A9 9 0 0 0 12 3z" />
    </svg>
  );
}

function SettingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

// ---- Menu Config ----

const ICON_MAP: Record<string, React.ReactNode> = {
  overview: <MoonIcon />,
  config: <SettingIcon />,
};

// ---- Default Config ----

const DEFAULT_CONFIG: ServerConfig = {
  root: "",
  bind: "0.0.0.0",
  port: 8080,
  show_hidden: false,
  max_depth: -1,
  speed_limit: null,
  webdav: false,
  auth_enabled: false,
  auth_user: null,
  auth_pass: null,
  tunnel_enabled: false,
  tunnel_bin: null,
};

// ---- Component ----

export default function Control() {
  const { t } = useTranslation("control");
  const [activePage, setActivePage] = useState<Page>("overview");
  const [config, setConfig, { save: saveConfig, reset: resetConfig }] =
    useLocalStorageDraft<ServerConfig>("mooncast-config", {
      defaultValue: DEFAULT_CONFIG,
    });

  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const { toggleTheme } = useTheme();

  const {
    status,
    addresses,
    starting,
    error: lifecycleError,
    logs,
    start,
    stop,
  } = useServerLifecycle({ config });

  useEffect(() => {
    initTheme();
  }, []);

  const toggleServer = useCallback(async () => {
    if (status?.running) {
      await stop();
    } else {
      await start();
    }
  }, [status?.running, start, stop]);

  const handleConfigChange = useCallback(
    (field: keyof ServerConfig, value: unknown) => {
      setConfig((prev) => ({ ...prev, [field]: value }));
    },
    [setConfig],
  );

  // 首次启动时，从系统获取桌面路径作为 root 默认值
  useEffect(() => {
    if (config.root) return;
    getDesktopPath()
      .then((desktop) => {
        handleConfigChange("root", desktop);
      })
      .catch(() => {});
  }, [config.root, handleConfigChange]);

  // 首次启动或重置后，设置 cloudflared 默认路径
  useEffect(() => {
    if (config.tunnel_bin) return;
    getAppDataBinPath()
      .then((binPath) => {
        handleConfigChange("tunnel_bin", binPath);
      })
      .catch(() => {});
  }, [config.tunnel_bin, handleConfigChange]);

  // PLACEHOLDER_RENDER

  const menuItems = useMemo<ItemType[]>(
    () =>
      (["overview", "config"] as const).map((key) => ({
        key,
        label: key === "overview" ? t("nav.overview") : t("nav.settings"),
        icon: ICON_MAP[key],
      })),
    [t],
  );

  const displayError = lifecycleError;

  return (
    <div className="h-screen flex bg-[var(--color-bg)] text-[var(--color-text)] text-[13px]">
      {/* Sidebar */}
      <aside className="w-[140px] shrink-0 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-sidebar)]">
        {/* Brand */}
        <div className="px-4 py-4 pb-5 flex flex-col gap-0.5">
          <div className="flex items-center">
            <div className="text-base font-bold tracking-tight">MoonCast</div>
            <Button
              className="ml-auto"
              type="text"
              icon={<MoonIcon />}
              onClick={toggleTheme}
              title={t("brand.toggleTheme")}
            />
          </div>
          <div className="text-[11px] text-[var(--color-text-muted)] mt-px">
            {t("brand.subtitle")}
          </div>
        </div>

        {/* Nav */}
        <Menu
          className="flex-1 px-2.5"
          items={menuItems}
          selectedKeys={[activePage]}
          onClick={({ key }) => setActivePage(key as Page)}
        />

        {/* Footer */}
        <div className="px-4 py-3.5 border-t border-[var(--color-border)] text-[11px] text-[var(--color-text-muted)]">
          <span
            className={`inline-block w-[7px] h-[7px] rounded-full mr-1.5 align-middle ${
              status?.running
                ? "bg-[var(--color-success)] shadow-[0_0_8px_var(--color-success)]"
                : "bg-[var(--color-text-muted)]"
            }`}
          />
          MoonCast v1.0
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-5">
        {displayError && (
          <div className="bg-[rgba(255,69,58,.1)] border border-[rgba(255,69,58,.3)] text-[var(--color-danger)] px-3.5 py-2.5 rounded-lg text-xs mb-4">
            {displayError}
          </div>
        )}

        {activePage === "overview" && (
          <Dashboard
            status={
              status ?? {
                running: false,
                local_addr: null,
                root: config.root,
                port: config.port,
              }
            }
            addresses={addresses}
            loading={starting}
            logs={logs}
            root={config.root}
            onToggle={toggleServer}
            onShowQr={setQrUrl}
            onRootChange={(path) => handleConfigChange("root", path)}
          />
        )}

        {activePage === "config" && (
          <Setting
            config={config}
            disabled={!!status?.running}
            loading={false}
            onChange={handleConfigChange}
            onSave={saveConfig}
            onReset={resetConfig}
          />
        )}
      </main>

      <QrModal
        url={qrUrl ?? ""}
        visible={!!qrUrl}
        onClose={() => setQrUrl(null)}
      />
    </div>
  );
}
