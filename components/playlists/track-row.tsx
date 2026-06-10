"use client";

import { Play } from "lucide-react";
import { Duration } from "@/components/shared/duration";
import { TrackContextMenu } from "./track-context-menu";
import { NowPlayingIndicator } from "@/components/player/now-playing-indicator";
import { DownloadDuo, type DuoSlot } from "./download-duo";
import type { PlaylistDetailItem, PendingKindJob } from "@/lib/db/repositories/playlist-item-repo";
import { fromPlaylistDetailItems } from "@/lib/player/queue-from-items";
import { cn } from "@/lib/utils";

interface Props {
  item: PlaylistDetailItem;
  position: number;
  onPlay?: () => void;
  isCurrent?: boolean;
  isPlaying?: boolean;
  defaultFormat?: "audio" | "video";
  onMutate?: () => void;
}

function slotFor(
  file: { format: string; fileSizeBytes: number } | null,
  job: PendingKindJob | null,
): DuoSlot {
  if (file) return { state: "present", format: file.format, sizeBytes: file.fileSizeBytes };
  if (job && (job.status === "queued" || job.status === "running")) return { state: "pending", status: job.status };
  if (job && job.status === "failed") return { state: "failed", jobId: job.id };
  return { state: "missing" };
}

export function TrackRow({ item, position, onPlay, isCurrent, isPlaying, defaultFormat = "audio", onMutate }: Props) {
  const youtubeUrl = `https://www.youtube.com/watch?v=${item.video.externalId}`;
  const queueItem = fromPlaylistDetailItems([item], defaultFormat)[0];
  const status = item.video.availabilityStatus;
  const downloadedKinds: Array<"audio" | "video"> = [
    ...(item.audioFile ? (["audio"] as const) : []),
    ...(item.videoFile ? (["video"] as const) : []),
  ];
  const unavailable = status !== "available" && status !== "unknown";
  return (
    <div className={cn(
      "group flex h-16 items-center gap-3 rounded-lg px-2 transition-colors hover:bg-[var(--color-muted-bg)]",
      unavailable && "opacity-60",
    )}>
      <div className="flex w-8 shrink-0 items-center justify-end text-xs tabular-nums text-[var(--color-fg-muted)]">
        {isCurrent ? <NowPlayingIndicator isPlaying={!!isPlaying} /> : position + 1}
      </div>
      {/* thumbnail with hover play overlay */}
      <button
        type="button"
        aria-label={`Play ${item.video.title}`}
        onClick={onPlay}
        className="relative h-12 w-[85px] shrink-0 overflow-hidden rounded-md bg-[var(--color-surface-2)]"
      >
        {item.video.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        )}
        <span className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
          <Play className="h-5 w-5 text-white" />
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{item.video.title}</div>
        <div className="truncate text-xs text-[var(--color-fg-muted)]">{item.video.channelTitle}</div>
      </div>
      <DownloadDuo
        videoId={item.video.id}
        canDownload={status === "available" || status === "unknown"}
        audio={slotFor(item.audioFile, item.pendingJobs.audio)}
        video={slotFor(item.videoFile, item.pendingJobs.video)}
        onMutate={onMutate}
      />
      <div className="hidden w-14 text-right font-mono text-xs tabular-nums text-[var(--color-fg-muted)] md:block">
        <Duration seconds={item.video.durationSeconds} />
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
