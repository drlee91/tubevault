"use client";

import { JobStatusPill } from "@/components/shared/job-status-pill";
import { StatusPill, type AvailabilityStatus } from "@/components/shared/status-pill";
import { Duration } from "@/components/shared/duration";
import { RelativeTime } from "@/components/shared/relative-time";
import { TrackContextMenu } from "./track-context-menu";
import type { PlaylistDetailItem } from "@/lib/db/repositories/playlist-item-repo";

export function TrackRow({ item, position }: { item: PlaylistDetailItem; position: number }) {
  const youtubeUrl = `https://www.youtube.com/watch?v=${item.video.externalId}`;
  const downloaded = item.audioFile || item.videoFile;
  return (
    <div className="flex h-12 items-center gap-3 rounded-md px-2 hover:bg-[var(--color-muted-bg)]">
      <span className="w-8 shrink-0 text-right text-xs text-[var(--color-muted)] tabular-nums">
        {position + 1}
      </span>
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
      />
      {downloaded && <span className="sr-only">downloaded</span>}
    </div>
  );
}
