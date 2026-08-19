import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import type { ServerStatus, AddressEntry } from "@/types";
import { Card } from "@/components/card";
import { AddressRow } from "./AddressRow";

interface AddressCardProps {
  status: ServerStatus;
  addresses: AddressEntry[];
  onShowQr: (url: string) => void;
}

// 本机图标
const LocalIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

// 局域网图标
const LanIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 2l6 0" /><path d="M12 2l0 4" />
    <rect x="6" y="6" width="12" height="4" rx="1" />
    <path d="M12 10l0 4" /><path d="M6 14l12 0" />
    <path d="M6 14l0 4" /><path d="M18 14l0 4" /><path d="M12 14l0 4" />
    <rect x="4" y="18" width="4" height="3" rx="0.5" />
    <rect x="10" y="18" width="4" height="3" rx="0.5" />
    <rect x="16" y="18" width="4" height="3" rx="0.5" />
  </svg>
);

// 公网图标
const PublicIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const ICON_MAP: Record<string, ReactElement> = {
  local: LocalIcon,
  lan: LanIcon,
  tunnel: PublicIcon,
};

export function AddressCard({ status, addresses, onShowQr }: AddressCardProps) {
  const { t } = useTranslation("control");
  if (!status.running || addresses.length === 0) return null;

  return (
    <Card
      description={t("dashboard.addressDescription")}
      className="mt-3 [&_.card-head]:px-4 [&_.card-head]:pt-2.5 [&_.card-head]:pb-1.5"
    >
      <div>
        {addresses.map((entry) => (
          <AddressRow
            key={entry.id}
            icon={ICON_MAP[entry.kind] || LanIcon}
            name={entry.name}
            address={entry.url}
            status={entry.status}
            statusText={entry.statusText}
            error={entry.error}
            onShowQr={onShowQr}
          />
        ))}
      </div>
    </Card>
  );
}
