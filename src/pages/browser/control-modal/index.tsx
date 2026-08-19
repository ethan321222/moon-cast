import { useState, useCallback, useImperativeHandle, forwardRef, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/modal";

export interface ControlModalRef {
  open: () => void;
}

type PowerAction = "shutdown" | "restart" | "sleep" | "lock";

interface ActionItem {
  key: PowerAction;
  icon: React.ReactNode;
  danger?: boolean;
}

const ACTIONS: ActionItem[] = [
  {
    key: "shutdown",
    icon: (
      <svg viewBox="0 0 24 24" width="2em" height="2em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
        <line x1="12" y1="2" x2="12" y2="12" />
      </svg>
    ),
    danger: true,
  },
  {
    key: "restart",
    icon: (
      <svg viewBox="0 0 24 24" width="2em" height="2em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10" />
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
      </svg>
    ),
    danger: true,
  },
  {
    key: "sleep",
    icon: (
      <svg viewBox="0 0 24 24" width="2em" height="2em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    ),
  },
  {
    key: "lock",
    icon: (
      <svg viewBox="0 0 24 24" width="2em" height="2em" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
];

/** 确认超时（毫秒） */
const CONFIRM_TIMEOUT = 3000;

async function executePower(action: PowerAction): Promise<void> {
  const resp = await fetch(`/utils/power/${action}`, {
    method: "POST",
    headers: { "X-Requested-With": "XMLHttpRequest" },
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(err.error || resp.statusText);
  }
}

export const ControlModal = forwardRef<ControlModalRef>((_props, ref) => {
  const { t } = useTranslation("browser");
  const [visible, setVisible] = useState(false);
  const [confirming, setConfirming] = useState<PowerAction | null>(null);
  const [loading, setLoading] = useState<PowerAction | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useImperativeHandle(ref, () => ({
    open: () => {
      setConfirming(null);
      setLoading(null);
      setVisible(true);
    },
  }));

  // 清理确认计时器
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
    setConfirming(null);
    setLoading(null);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleClick = useCallback(
    async (item: ActionItem) => {
      if (loading) return;

      // 危险操作需要二次确认
      if (item.danger && confirming !== item.key) {
        setConfirming(item.key);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setConfirming(null);
          timerRef.current = null;
        }, CONFIRM_TIMEOUT);
        return;
      }

      // 执行操作
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setConfirming(null);
      setLoading(item.key);
      try {
        await executePower(item.key);
        handleClose();
      } catch {
        setLoading(null);
      }
    },
    [confirming, loading, handleClose],
  );

  return (
    <Modal open={visible} onClose={handleClose} title={t("control.title")} width={320}>
      <div className="grid grid-cols-2 gap-3">
        {ACTIONS.map((item) => {
          const isConfirming = confirming === item.key;
          const isLoading = loading === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleClick(item)}
              disabled={!!loading && !isLoading}
              className={[
                "flex flex-col items-center justify-center gap-2 p-4 rounded-lg border transition-all duration-150 cursor-pointer",
                "hover:bg-[var(--color-bg-hover)]",
                isConfirming
                  ? "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400"
                  : "border-[var(--color-border)] text-[var(--color-text)]",
                isLoading ? "opacity-60 pointer-events-none" : "",
                !!loading && !isLoading ? "opacity-40" : "",
              ].join(" ")}
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-sm font-medium">
                {isConfirming ? t("control.confirm") : t(`control.${item.key}`)}
              </span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
});

ControlModal.displayName = "ControlModal";
