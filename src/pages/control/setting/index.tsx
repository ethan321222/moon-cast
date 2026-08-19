import { useCallback, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import type { ServerConfig } from "@/types";
import type { ThemeSetting } from "@/hooks/useTheme";
import { useTheme } from "@/hooks/useTheme";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { getLogDirPath } from "@/api/client";
import { SettingBox } from "./SettingBox";
import { Input } from "@/components/input";
import { InputNumber } from "@/components/input-number";
import { Button } from "@/components/button";
import { Select } from "@/components/select";
import { Switch } from "@/components/switch";
import { Modal } from "@/components/modal";
import i18n from "@/locales";

const DEFAULT_AUTH_USER = "admin";
const DEFAULT_AUTH_PASS = "123456";

interface SettingProps {
  config: ServerConfig;
  disabled: boolean;
  loading: boolean;
  onChange: (field: keyof ServerConfig, value: unknown) => void;
  onSave: () => void;
  onReset: () => void;
}

export function Setting({ config, disabled, loading, onChange, onSave, onReset }: SettingProps) {
  const { t } = useTranslation("control");
  const { setting, setTheme } = useTheme();
  const [lang = "system", setLang] = useLocalStorage<string>("mooncast-lang", {
    defaultValue: "system",
    serializer: (v) => v,
    deserializer: (raw) => {
      if (raw.startsWith("zh")) return "zh";
      if (raw.startsWith("en")) return "en";
      return "system";
    },
  });
  const [logDir, setLogDir] = useState("");
  const [webDavWarningOpen, setWebDavWarningOpen] = useState(false);

  useEffect(() => {
    getLogDirPath().then(setLogDir).catch(() => {});
  }, []);

  const handleAuthEnabledChange = useCallback((enabled: boolean) => {
    onChange("auth_enabled", enabled);
    if (!enabled) return;

    if (!config.auth_user?.trim()) {
      onChange("auth_user", DEFAULT_AUTH_USER);
    }
    if (!config.auth_pass?.trim()) {
      onChange("auth_pass", DEFAULT_AUTH_PASS);
    }
  }, [config.auth_pass, config.auth_user, onChange]);

  const enableWebDavReadOnly = useCallback(() => {
    onChange("webdav", true);
    setWebDavWarningOpen(false);
  }, [onChange]);

  const enableWebDavWithAuth = useCallback(() => {
    onChange("auth_enabled", true);
    if (!config.auth_user?.trim()) {
      onChange("auth_user", DEFAULT_AUTH_USER);
    }
    if (!config.auth_pass?.trim()) {
      onChange("auth_pass", DEFAULT_AUTH_PASS);
    }
    onChange("webdav", true);
    setWebDavWarningOpen(false);
  }, [config.auth_pass, config.auth_user, onChange]);

  const handleWebDavChange = useCallback((enabled: boolean) => {
    if (!enabled) {
      onChange("webdav", false);
      return;
    }
    setWebDavWarningOpen(true);
  }, [onChange]);

  const openLogDir = useCallback(async () => {
    if (!logDir) return;
    try {
      const mod = await import("@tauri-apps/plugin-opener");
      await mod.revealItemInDir(logDir);
    } catch (e) {
      console.error("打开目录失败:", e);
    }
  }, [logDir]);

  const browseBinaryDir = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === "string") {
      const sep = selected.includes("/") ? "/" : "\\";
      const binName = "cloudflared.exe";
      onChange("tunnel_bin", selected + sep + binName);
    }
  }, [onChange]);

  const pickFolder = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === "string") {
      onChange("root", selected);
    }
  }, [onChange]);

  return (
    <div className="animate-[fade-in_.25s_ease]">
      {/* 外观 */}
      <SettingBox title={t("settings.appearance")}>
        <div className="px-4 py-2.5 border-b border-[var(--color-border)] flex items-center justify-between transition-colors hover:bg-[var(--color-bg-hover)]">
          <div className="text-xs font-medium">{t("settings.themeMode")}</div>
          <Select
            value={setting}
            options={[
              { value: "system", label: t("settings.themeSystem") },
              { value: "light", label: t("settings.themeLight") },
              { value: "dark", label: t("settings.themeDark") },
            ]}
            onChange={(v) => setTheme(v as ThemeSetting)}
          />
        </div>
        <div className="px-4 py-2.5 flex items-center justify-between transition-colors hover:bg-[var(--color-bg-hover)]">
          <div className="text-xs font-medium">{t("settings.language")}</div>
          <Select
            value={lang}
            options={[
              { value: "system", label: t("settings.langSystem") },
              { value: "zh", label: t("settings.langZh") },
              { value: "en", label: "English" },
            ]}
            onChange={(v) => {
              setLang(v);
              let lng = v;
              if (v === "zh") lng = "zh-CN";
              if (v === "system") lng = navigator.language.startsWith("zh") ? "zh-CN" : "en";
              i18n.changeLanguage(lng);
            }}
          />
        </div>
      </SettingBox>

      {/* 服务 */}
      <SettingBox title={t("settings.server")}>
        <div className="px-4 py-2.5 border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-bg-hover)]">
          <div className="text-xs font-medium mb-0.5">{t("settings.rootDir")}</div>
          <div className="text-[11px] text-[var(--color-text-secondary)] leading-snug">{t("settings.rootDirDesc")}</div>
          <div className="mt-1.5 flex gap-2">
            <Input
              value={config.root}
              readOnly
              disabled={disabled}
            />
            <Button onClick={pickFolder} disabled={disabled}>
              {t("settings.rootDirSelect")}
            </Button>
          </div>
        </div>
        <div className="px-4 py-2.5 border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-bg-hover)]">
          <div className="text-xs font-medium mb-0.5">{t("settings.port")}</div>
          <div className="text-[11px] text-[var(--color-text-secondary)] leading-snug">{t("settings.portDesc")}</div>
          <div className="mt-1.5">
            <InputNumber
              value={config.port}
              onChange={(v) => onChange("port", v)}
              min={1}
              max={65535}
              fallback={8080}
              disabled={disabled}
            />
          </div>
        </div>
        <div className="px-4 py-2.5 border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-bg-hover)]">
          <div className="text-xs font-medium mb-0.5">{t("settings.bindAddr")}</div>
          <div className="text-[11px] text-[var(--color-text-secondary)] leading-snug">{t("settings.bindAddrDesc")}</div>
          <div className="mt-1.5">
            <Input
              value={config.bind}
              onChange={(e) => onChange("bind", (e.target as HTMLInputElement).value)}
              disabled={disabled}
            />
          </div>
        </div>
        <div className="px-4 py-2.5 border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-bg-hover)]">
          <div className="text-xs font-medium mb-0.5">{t("settings.maxDepth")}</div>
          <div className="text-[11px] text-[var(--color-text-secondary)] leading-snug">{t("settings.maxDepthDesc")}</div>
          <div className="mt-1.5">
            <InputNumber
              value={config.max_depth}
              onChange={(v) => onChange("max_depth", v)}
              min={-1}
              fallback={-1}
              disabled={disabled}
            />
          </div>
        </div>
        <div className="px-4 py-2.5 flex items-center justify-between gap-4 transition-colors hover:bg-[var(--color-bg-hover)]">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium mb-0.5">{t("settings.showHidden")}</div>
            <div className="text-[11px] text-[var(--color-text-secondary)] leading-snug">{t("settings.showHiddenDesc")}</div>
          </div>
          <Switch
            checked={config.show_hidden}
            onChange={(v) => onChange("show_hidden", v)}
            disabled={disabled}
          />
        </div>
      </SettingBox>

      {/* 访问认证 */}
      <SettingBox title={t("settings.auth")}>
        <div className="px-4 py-2.5 border-b border-[var(--color-border)] flex items-center justify-between gap-4 transition-colors hover:bg-[var(--color-bg-hover)]">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium mb-0.5">{t("settings.authEnabled")}</div>
            <div className="text-[11px] text-[var(--color-text-secondary)] leading-snug">{t("settings.authEnabledDesc")}</div>
          </div>
          <Switch
            checked={config.auth_enabled}
            onChange={handleAuthEnabledChange}
            disabled={disabled}
          />
        </div>
        {config.auth_enabled && (
          <>
            <div className="px-4 py-2.5 border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-bg-hover)]">
              <div className="text-xs font-medium mb-0.5">{t("settings.authUser")}</div>
              <div className="text-[11px] text-[var(--color-text-secondary)] leading-snug">{t("settings.authUserDesc")}</div>
              <div className="mt-1.5">
                <Input
                  value={config.auth_user || ""}
                  onChange={(e) => onChange("auth_user", (e.target as HTMLInputElement).value)}
                  disabled={disabled}
                  placeholder={DEFAULT_AUTH_USER}
                />
              </div>
            </div>
            <div className="px-4 py-2.5 transition-colors hover:bg-[var(--color-bg-hover)]">
              <div className="text-xs font-medium mb-0.5">{t("settings.authPass")}</div>
              <div className="text-[11px] text-[var(--color-text-secondary)] leading-snug">{t("settings.authPassDesc")}</div>
              <div className="mt-1.5">
                <Input.Password
                  value={config.auth_pass || ""}
                  onChange={(e) => onChange("auth_pass", (e.target as HTMLInputElement).value)}
                  disabled={disabled}
                  placeholder={t("settings.authPassPlaceholder")}
                />
              </div>
            </div>
          </>
        )}
      </SettingBox>

      {/* WebDAV */}
      <SettingBox title={t("settings.webdav")}>
        <div className="px-4 py-2.5 flex items-center justify-between gap-4 transition-colors hover:bg-[var(--color-bg-hover)]">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium mb-0.5">{t("settings.webdavEnabled")}</div>
            <div className="text-[11px] text-[var(--color-text-secondary)] leading-snug">{t("settings.webdavEnabledDesc")}</div>
          </div>
          <Switch
            checked={config.webdav}
            onChange={handleWebDavChange}
            disabled={disabled}
          />
        </div>
      </SettingBox>

      {/* 公网访问 */}
      <SettingBox title={t("settings.tunnel")}>
        <div className="px-4 py-2.5 border-b border-[var(--color-border)] flex items-center justify-between gap-4 transition-colors hover:bg-[var(--color-bg-hover)]">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium mb-0.5">{t("settings.tunnelEnabled")}</div>
            <div className="text-[11px] text-[var(--color-text-secondary)] leading-snug">{t("settings.tunnelEnabledDesc")}</div>
          </div>
          <Switch
            checked={config.tunnel_enabled}
            onChange={(v) => onChange("tunnel_enabled", v)}
            disabled={disabled}
          />
        </div>
        <div className="px-4 py-2.5 transition-colors hover:bg-[var(--color-bg-hover)]">
          <div className="text-xs font-medium mb-0.5">{t("settings.tunnelBinDir")}</div>
          <div className="text-[11px] text-[var(--color-text-secondary)] leading-snug">
            {t("settings.tunnelBinDirDesc")}
          </div>
          <div className="mt-1.5 flex gap-2">
            <Input
              value={config.tunnel_bin ? config.tunnel_bin.replace(/[\\\/][^\\\/]+$/, "") : ""}
              readOnly
              disabled={disabled}
            />
            <Button onClick={browseBinaryDir} disabled={disabled}>
              {t("settings.tunnelBrowse")}
            </Button>
          </div>
        </div>
      </SettingBox>

      {/* 日志 */}
      <SettingBox title={t("settings.logs")}>
        <div className="px-4 py-2.5 flex items-center justify-between transition-colors hover:bg-[var(--color-bg-hover)]">
          <div className="text-xs font-medium">{t("settings.logDir")}</div>
          <Button onClick={openLogDir} disabled={disabled || !logDir}>
            {t("settings.openDir")}
          </Button>
        </div>
      </SettingBox>

      <div className="flex gap-2.5 justify-end pt-2 pb-1">
        <Button onClick={onReset} disabled={disabled}>
          {t("common:reset")}
        </Button>
        <Button type="primary" onClick={onSave} disabled={disabled || loading}>
          {loading ? t("common:saving") : t("common:save")}
        </Button>
      </div>

      <Modal
        open={webDavWarningOpen}
        title={t("settings.webdavWarningTitle")}
        onClose={() => setWebDavWarningOpen(false)}
        width={460}
      >
        <div className="w-full text-left text-[13px] leading-5 text-[var(--color-text)]">
          <p className="m-0 text-[var(--color-text-secondary)]">
            {t("settings.webdavWarningBody")}
          </p>
          <div className="mt-3 px-3 py-2 rounded border border-[var(--color-danger)] bg-[var(--color-danger-subtle)] text-[var(--color-danger)]">
            {t("settings.webdavWarningReadonly")}
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button onClick={() => setWebDavWarningOpen(false)}>
              {t("common:cancel")}
            </Button>
            <Button onClick={enableWebDavReadOnly}>
              {t("settings.webdavEnableReadonly")}
            </Button>
            <Button type="primary" onClick={enableWebDavWithAuth}>
              {t("settings.webdavEnableWithAuth")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
