import type { ServerStatus, AddressEntry } from "../../../types";
import { ServerPanel } from "./ServerPanel";
import { AddressCard } from "./AddressCard";
import { RecentRequests } from "./RecentRequests";

interface DashboardProps {
  status: ServerStatus;
  addresses: AddressEntry[];
  loading: boolean;
  logs: string[];
  root: string;
  onToggle: () => void;
  onShowQr: (url: string) => void;
  onRootChange: (path: string) => void;
}

export function Dashboard({ status, addresses, loading, logs, root, onToggle, onShowQr, onRootChange }: DashboardProps) {
  return (
    <div className="animate-[fade-in_.25s_ease]">
      <ServerPanel
        status={status}
        loading={loading}
        root={root}
        onToggle={onToggle}
        onRootChange={onRootChange}
      />
      <AddressCard
        status={status}
        addresses={addresses}
        onShowQr={onShowQr}
      />
      {status.running && <RecentRequests logs={logs} />}
    </div>
  );
}
