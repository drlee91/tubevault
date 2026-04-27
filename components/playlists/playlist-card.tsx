import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ListMusic, RefreshCw } from "lucide-react";
import { RelativeTime } from "@/components/shared/relative-time";
import type { PlaylistStatsRow } from "@/lib/services/playlist-service";

export function PlaylistCard({ p }: { p: PlaylistStatsRow }) {
  const syncing = p.activeSyncRunId !== null;
  return (
    <Link href={`/playlists/${p.id}`}>
      <Card className="hover:border-[var(--color-accent)]">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <ListMusic className="h-5 w-5 text-[var(--color-muted)]" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-sm font-medium">{p.title ?? p.url}</h3>
                {syncing && <RefreshCw className="h-3 w-3 animate-spin text-[var(--color-accent)]" aria-label="syncing" />}
              </div>
              <p className="text-xs text-[var(--color-muted)]">
                {p.channelTitle ?? "—"} · {p.stats.totalItems} items · {p.stats.downloadedItems} downloaded
              </p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                last sync: <RelativeTime iso={p.lastSyncedAt} />
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
