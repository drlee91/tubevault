import { SyncNowButton } from "./sync-now-button";
import { DeletePlaylistButton } from "./delete-playlist-button";
import { RelativeTime } from "@/components/shared/relative-time";
import type { PlaylistStatsRow } from "@/lib/services/playlist-service";

export function PlaylistDetailHeader({ playlist }: { playlist: PlaylistStatsRow }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] pb-4">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-semibold">{playlist.title ?? "Untitled"}</h1>
        <p className="text-sm text-[var(--color-muted)]">
          {playlist.channelTitle ?? "—"} · {playlist.stats.totalItems} items ·{" "}
          {playlist.stats.downloadedItems} downloaded · last sync{" "}
          <RelativeTime iso={playlist.lastSyncedAt} />
        </p>
      </div>
      <div className="flex gap-2">
        <SyncNowButton playlistId={playlist.id} disabled={playlist.activeSyncRunId !== null} />
        <DeletePlaylistButton playlistId={playlist.id} />
      </div>
    </header>
  );
}
