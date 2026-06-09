"use client";

import { Music, Film } from "lucide-react";
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
  const queueItem = fromPlaylistDetailItems([item], defaultFormat)[0];
  const status = item.video.availabilityStatus;
  const downloadedKinds: Array<"audio" | "video"> = [
    ...(item.audioFile ? (["audio"] as const) : []),
    ...(item.videoFile ? (["video"] as const) : []),
  ];
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
      {/* Downloaded media on disk — one icon per kind, empty when nothing is local. */}
      <div className="flex w-12 shrink-0 items-center justify-end gap-1 text-[var(--color-status-available)]">
        {item.audioFile && (
          <span title={`audio downloaded (${item.audioFile.format})`}>
            <Music className="h-3.5 w-3.5" aria-label="audio downloaded" />
          </span>
        )}
        {item.videoFile && (
          <span title={`video downloaded (${item.videoFile.format})`}>
            <Film className="h-3.5 w-3.5" aria-label="video downloaded" />
          </span>
        )}
      </div>
      <div className="w-32 text-right">
        {item.pendingJob ? (
          <JobStatusPill status={item.pendingJob.status as Parameters<typeof JobStatusPill>[0]["status"]} />
        ) : (
          <StatusPill status={status as AvailabilityStatus} />
        )}
      </div>
      <TrackContextMenu
        videoId={item.video.id}
        externalUrl={youtubeUrl}
        canDownload={status === "available" || status === "unknown"}
        downloadedKinds={downloadedKinds}
        queueItem={queueItem}
      />
    </div>
  );
}
