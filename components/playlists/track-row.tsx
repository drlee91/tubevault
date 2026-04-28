"use client";

import { JobStatusPill } from "@/components/shared/job-status-pill";
import { StatusPill, type AvailabilityStatus } from "@/components/shared/status-pill";
import { Duration } from "@/components/shared/duration";
import { RelativeTime } from "@/components/shared/relative-time";
import { TrackContextMenu } from "./track-context-menu";
import { NowPlayingIndicator } from "@/components/player/now-playing-indicator";
import type { PlaylistDetailItem } from "@/lib/db/repositories/playlist-item-repo";
import { fromPlaylistDetailItems } from "@/lib/player/queue-from-items";

interface Props {
  item: PlaylistDetailItem;
  position: number;
  onPlay?: () => void;
  isCurrent?: boolean;
  isPlaying?: boolean;
  defaultFormat?: "audio" | "video";
}

export function TrackRow({ item, position, onPlay, isCurrent, isPlaying, defaultFormat = "audio" }: Props) {
  const youtubeUrl = `https://www.youtube.com/watch?v=${item.video.externalId}`;
  const downloaded = item.audioFile || item.videoFile;
  const queueItem = fromPlaylistDetailItems([item], defaultFormat)[0];
  return (
    <div className="flex h-12 items-center gap-3 rounded-md px-2 hover:bg-[var(--color-muted-bg)]">
      <button
        type="button"
        aria-label={`Play ${item.video.title}`}
        onClick={onPlay}
        className="flex w-8 shrink-0 items-center justify-end text-xs text-[var(--color-muted)] tabular-nums"
      >
        {isCurrent ? <NowPlayingIndicator isPlaying={!!isPlaying} /> : position + 1}
      </button>
      {item.video.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.video.thumbnailUrl}
          alt=""
          className="h-9 w-12 shrink-0 rounded object-cover"
        />
      ) : (
        <div className="h-9 w-12 shrink-0 rounded bg-[var(--color-muted-bg)]" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{item.video.title}</div>
        <div className="truncate text-xs text-[var(--color-muted)]">{item.video.channelTitle}</div>
      </div>
      <div className="hidden w-16 text-right text-xs text-[var(--color-muted)] tabular-nums md:block">
        <Duration seconds={item.video.durationSeconds} />
      </div>
      <div className="hidden w-20 text-right text-xs text-[var(--color-muted)] md:block">
        <RelativeTime iso={item.addedAt} />
      </div>
      <div className="w-32 text-right">
        {item.pendingJob ? (
          <JobStatusPill status={item.pendingJob.status as Parameters<typeof JobStatusPill>[0]["status"]} />
        ) : (
          <StatusPill status={item.video.availabilityStatus as AvailabilityStatus} />
        )}
      </div>
      <TrackContextMenu
        videoId={item.video.id}
        externalUrl={youtubeUrl}
        available={item.video.availabilityStatus === "available"}
        queueItem={queueItem}
      />
      {downloaded && <span className="sr-only">downloaded</span>}
    </div>
  );
}
