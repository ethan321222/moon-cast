import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import type { ServerStatus } from "@/types";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Input } from "@/components/input";
import styles from "./ServerPanel.module.css";

interface ServerPanelProps {
  status: ServerStatus;
  loading: boolean;
  root: string;
  onToggle: () => void;
  onRootChange: (path: string) => void;
}

export function ServerPanel({ status, loading, root, onToggle, onRootChange }: ServerPanelProps) {
  const { t } = useTranslation("control");
  const pickFolder = useCallback(async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === "string") {
      onRootChange(selected);
    }
  }, [onRootChange]);

  return (
    <Card className={`${styles.panel} ${status.running ? styles.running : ""}`}>
      {/* 背景光晕 */}
      <div className={styles.glow} />

      {/* 月亮启停控件 */}
      <div className={styles.orbit}>
        <button
          className={styles.moonBtn}
          onClick={onToggle}
          disabled={loading}
          title={t("dashboard.startStop")}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.39 5.39 0 0 1-5.4-5.4c0-.46-.04-.92-.1-1.36A9 9 0 0 0 12 3z" />
          </svg>
        </button>
      </div>

      {/* 状态卡片 */}
      <div className="flex-1 min-w-0 relative flex flex-col gap-2.5">
        <div className="flex items-start gap-2">
          <Button
            danger={status.running}
            onClick={onToggle}
            disabled={loading}
          >
            {loading ? t("dashboard.loading") : status.running ? t("dashboard.stop") : t("dashboard.start")}
          </Button>
        </div>
        <div className="flex items-start gap-2">
          <Button
            className="shrink-0 min-w-[108px] text-center"
            onClick={pickFolder}
            disabled={status.running || loading}
          >
            {t("dashboard.setRoot")}
          </Button>
        </div>
        <div className="min-w-[108px]">
          <Input value={root} readOnly disabled={status.running} />
        </div>
      </div>
    </Card>
  );
}
