import { useTranslation } from "react-i18next";
import { Card } from "@/components/card";

interface RecentRequestsProps {
  logs: string[];
}

export function RecentRequests({ logs }: RecentRequestsProps) {
  const { t } = useTranslation("control");
  return (
    <Card description={t("dashboard.recentRequests")} className="mt-3">
      <div className="overflow-hidden border-t border-[rgba(0,0,0,.06)]">
        {logs.length === 0 ? (
          <div className="text-center text-[var(--color-text-muted)] py-7 text-xs">{t("dashboard.noRequests")}</div>
        ) : (
          <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
            {logs.map((line, i) => (
              <div key={i} className="px-4 py-1 text-xs">
                <span className="font-['Cascadia_Code','Fira_Code',monospace] text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap break-all">{line}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
