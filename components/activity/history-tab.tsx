import { ensureBooted } from "@/lib/boot";
import { HistoryRow } from "./history-row";
import type { SyncRunRow } from "./history-row";
import { EmptyState } from "@/components/shared/empty-state";
import { Activity } from "lucide-react";

/** Pure sync component — accepts pre-fetched runs. Easy to unit-test. */
export function HistoryList({ runs }: { runs: SyncRunRow[] }) {
  if (runs.length === 0) {
    return <EmptyState icon={Activity} title="No syncs yet" />;
  }
  return (
    <div className="space-y-2">
      {runs.map((r) => (
        <HistoryRow key={r.id} run={r} />
      ))}
    </div>
  );
}

/** RSC wrapper — fetches data and delegates rendering to HistoryList. */
export async function HistoryTab({ statusFilter }: { statusFilter?: string }) {
  const ctx = await ensureBooted();
  const runs = ctx.playlistService.recentSyncRuns({ limit: 50, status: statusFilter });
  return <HistoryList runs={runs} />;
}
