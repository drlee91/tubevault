"use client";

import { Play, Shuffle, MoreHorizontal, RefreshCw, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CoverMosaic } from "./cover-mosaic";
import { DownloadMissingButton } from "./download-missing-button";
import { RelativeTime } from "@/components/shared/relative-time";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePlayerStoreApiOptional } from "@/lib/client/use-player-store";
import { fromPlaylistDetailItems } from "@/lib/player/queue-from-items";
import { buildQueue } from "@/lib/player/queue-build";
import { syncPlaylistAction, deletePlaylistAction } from "@/lib/actions/playlist-actions";
import type { PlaylistStatsRow } from "@/lib/services/playlist-service";
import type { PlaylistDetailItem } from "@/lib/db/repositories/playlist-item-repo";

interface Props {
  playlist: PlaylistStatsRow;
  items?: PlaylistDetailItem[];
  defaultFormat?: "audio" | "video";
}

export function PlaylistDetailHeader({ playlist, items, defaultFormat = "audio" }: Props) {
  const store = usePlayerStoreApiOptional();
  const router = useRouter();

  // Sync pending state
  const [syncPending, startSync] = useTransition();
  // Delete dialog + pending state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, startDelete] = useTransition();

  const pct =
    playlist.stats.totalItems > 0
      ? Math.round((playlist.stats.downloadedItems / playlist.stats.totalItems) * 100)
      : 0;
  const missing = playlist.stats.totalItems - playlist.stats.downloadedItems;

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

  function onSync() {
    startSync(async () => {
      const r = await syncPlaylistAction(playlist.id);
      if (!r.ok) toast.error("Sync failed", { description: r.error.message });
      else toast.success("Sync queued");
    });
  }

  function onDeleteConfirm() {
    startDelete(async () => {
      const r = await deletePlaylistAction(playlist.id);
      if (!r.ok) {
        toast.error("Delete failed", { description: r.error.message });
        return;
      }
      toast.success("Playlist deleted");
      router.push("/playlists");
    });
  }

  const syncDisabled = playlist.activeSyncRunId !== null || syncPending;

  return (
    <>
      <header className="flex flex-wrap items-end gap-6 border-b border-[var(--color-line)] pb-6">
        <CoverMosaic
          thumbs={(items ?? []).slice(0, 8).map((i) => i.video.thumbnailUrl)}
          className="h-40 w-40 shrink-0"
        />

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-faint)]">
            Playlist
          </p>
          <h1 className="mt-1 truncate text-3xl font-semibold">{playlist.title ?? "Untitled"}</h1>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
            {playlist.channelTitle ?? "—"} · {playlist.stats.totalItems} items · last sync{" "}
            <RelativeTime iso={playlist.lastSyncedAt} />
          </p>

          {/* download progress */}
          <div className="mt-3 max-w-md">
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-line)]">
              <div
                className="h-full rounded-full bg-[var(--color-ok)]"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-[var(--color-fg-muted)]">
              {playlist.stats.downloadedItems} von {playlist.stats.totalItems} vollständig
              {missing > 0 && (
                <>
                  {" "}
                  ·{" "}
                  <DownloadMissingButton playlistId={playlist.id} variant="link" />
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {items && store && (
            <>
              <button
                aria-label="Play all"
                onClick={() => playAll(false)}
                className="grid h-12 w-12 place-items-center rounded-full bg-[var(--color-brand)] text-[var(--color-brand-fg)] transition-transform hover:scale-105"
              >
                <Play className="h-5 w-5" />
              </button>
              <button
                aria-label="Shuffle play"
                onClick={() => playAll(true)}
                className="grid h-10 w-10 place-items-center rounded-full border border-[var(--color-line)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              >
                <Shuffle className="h-4 w-4" />
              </button>
            </>
          )}

          {/* overflow menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Playlist actions"
              render={
                <button
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "h-9 w-9 p-0",
                  )}
                />
              }
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={syncDisabled}
                onClick={onSync}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync now
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={false}
                className="text-[var(--color-status-removed)] focus:text-[var(--color-status-removed)]"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete playlist
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                Playback preference: {playlist.defaultFormat}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Delete confirm dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete playlist?</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            This removes the playlist and its item links. Downloaded files and video metadata are kept.
          </DialogDescription>
          <DialogFooter>
            <Button variant="ghost" disabled={deletePending} onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={onDeleteConfirm}
              disabled={deletePending}
              className="bg-[var(--color-status-removed)] text-white hover:bg-[var(--color-status-removed)]/90"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
