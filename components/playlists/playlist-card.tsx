import Link from "next/link";
import { Play, RefreshCw } from "lucide-react";
import { CoverMosaic } from "./cover-mosaic";
import type { PlaylistStatsRow } from "@/lib/services/playlist-service";

export function PlaylistCard({ p }: { p: PlaylistStatsRow }) {
  const syncing = p.activeSyncRunId !== null;
  const pct = p.stats.totalItems > 0 ? Math.round((p.stats.downloadedItems / p.stats.totalItems) * 100) : 0;
  return (
    <Link
      href={`/playlists/${p.id}`}
      className="group block overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-muted-bg)] transition-colors hover:border-[var(--color-faint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]"
    >
      <div className="relative aspect-square">
        <CoverMosaic thumbs={p.coverThumbs} className="h-full w-full rounded-none" />
        <span aria-hidden className="absolute bottom-2 right-2 grid h-10 w-10 place-items-center rounded-full bg-[var(--color-brand)] text-[var(--color-brand-fg)] opacity-0 transition-opacity group-hover:opacity-100">
          <Play className="h-5 w-5" />
        </span>
      </div>
      <div className="p-3">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-medium">{p.title ?? p.url}</h3>
          {syncing && <RefreshCw className="h-3 w-3 shrink-0 animate-spin text-[var(--color-brand)]" aria-label="syncing" />}
        </div>
        <p className="truncate text-xs text-[var(--color-fg-muted)]">{p.channelTitle ?? "—"} · {p.stats.totalItems} Titel</p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--color-line)]">
          <div className="h-full rounded-full bg-[var(--color-ok)]" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </Link>
  );
}
