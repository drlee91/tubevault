"use client";

import { Play, Shuffle } from "lucide-react";
import { SyncNowButton } from "./sync-now-button";
import { DeletePlaylistButton } from "./delete-playlist-button";
import { RelativeTime } from "@/components/shared/relative-time";
import { Button } from "@/components/ui/button";
import { usePlayerStoreApiOptional } from "@/lib/client/use-player-store";
import { fromPlaylistDetailItems } from "@/lib/player/queue-from-items";
import { buildQueue } from "@/lib/player/queue-build";
import type { PlaylistStatsRow } from "@/lib/services/playlist-service";
import type { PlaylistDetailItem } from "@/lib/db/repositories/playlist-item-repo";

interface Props {
  playlist: PlaylistStatsRow;
  items?: PlaylistDetailItem[];
  defaultFormat?: "audio" | "video";
}

export function PlaylistDetailHeader({ playlist, items, defaultFormat = "audio" }: Props) {
  const store = usePlayerStoreApiOptional();

  function playAll(shuffle: boolean) {
    if (!store || !items) return;
    const playable = items.filter((i) => i.inPlaylist);
    const queueItems = fromPlaylistDetailItems(playable, defaultFormat);
    const built = buildQueue(queueItems, 0);
    store.getState().setQueue(built.queue, built.currentIndex);
    if (shuffle && !store.getState().shuffle) store.getState().toggleShuffle();
    if (!shuffle && store.getState().shuffle) store.getState().toggleShuffle();
    store.getState().play();
  }

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
        {items && store && (
          <>
            <Button onClick={() => playAll(false)} aria-label="Play all">
              <Play className="mr-1 h-4 w-4" /> Play All
            </Button>
            <Button variant="outline" onClick={() => playAll(true)} aria-label="Shuffle play">
              <Shuffle className="mr-1 h-4 w-4" /> Shuffle Play
            </Button>
          </>
        )}
        <SyncNowButton playlistId={playlist.id} disabled={playlist.activeSyncRunId !== null} />
        <DeletePlaylistButton playlistId={playlist.id} />
      </div>
    </header>
  );
}
