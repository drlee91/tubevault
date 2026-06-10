"use client";

import {
  useStandaloneVideos,
  type VideoSerialized,
} from "@/lib/client/use-standalone-videos";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Duration } from "@/components/shared/duration";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorCard } from "@/components/shared/error-card";
import { SkeletonRow } from "@/components/shared/skeleton-row";
import { NowPlayingIndicator } from "@/components/player/now-playing-indicator";
import { Video } from "lucide-react";
import { usePlayerStoreApiOptional } from "@/lib/client/use-player-store";
import { useSyncExternalStore } from "react";
import { fromStandaloneVideos } from "@/lib/player/queue-from-items";
import { buildQueue } from "@/lib/player/queue-build";
import { DownloadDuo, type DuoSlot } from "./download-duo";

// Standalone rows have no per-file metadata or job tracking — slots are
// degraded: "present" if the kind is in availableKinds, "missing" otherwise.
// The optimistic spinner in DownloadDuo bridges the gap until SWR refreshes.
function slotForKind(
  kinds: Array<"audio" | "video">,
  kind: "audio" | "video",
): DuoSlot {
  return kinds.includes(kind)
    ? { state: "present", format: kind === "audio" ? "mp3" : "mp4" }
    : { state: "missing" };
}

export function StandaloneList() {
  const { data, error, mutate, isLoading } = useStandaloneVideos();
  const storeApi = usePlayerStoreApiOptional();

  const currentVideoId = useSyncExternalStore(
    storeApi ? (cb) => storeApi.subscribe(cb) : () => () => {},
    () => {
      if (!storeApi) return undefined;
      const s = storeApi.getState();
      return s.currentIndex >= 0 ? s.queue[s.currentIndex]?.videoId : undefined;
    },
    () => undefined,
  );

  const isPlaying = useSyncExternalStore(
    storeApi ? (cb) => storeApi.subscribe(cb) : () => () => {},
    () => (storeApi ? storeApi.getState().isPlaying : false),
    () => false,
  );

  if (error) return <ErrorCard title="Couldn't load standalone videos" onRetry={() => mutate()} />;
  if (isLoading || !data) return <SkeletonRow />;
  if (data.videos.length === 0) {
    return (
      <EmptyState
        icon={Video}
        title="No standalone videos"
        description="Add one via the + Add menu."
      />
    );
  }

  function play(index: number) {
    if (!storeApi || !data) return;
    const queueItems = fromStandaloneVideos(data.videos);
    const built = buildQueue(queueItems, index);
    storeApi.getState().setQueue(built.queue, built.currentIndex);
    storeApi.getState().play();
  }

  return (
    <div className="space-y-1">
      {data.videos.map((v: VideoSerialized, i: number) => {
        const unavailable = v.availabilityStatus !== "available" && v.availabilityStatus !== "unknown";
        return (
        <div
          key={v.id}
          className={cn(
            "group flex h-16 items-center gap-3 rounded-lg px-2 transition-colors hover:bg-[var(--color-muted-bg)]",
            unavailable && "opacity-60",
          )}
        >
          <div className="flex w-8 shrink-0 items-center justify-end text-xs tabular-nums text-[var(--color-fg-muted)]">
            {currentVideoId === v.id
              ? <NowPlayingIndicator isPlaying={isPlaying} />
              : i + 1}
          </div>
          {/* thumbnail with hover play overlay */}
          <button
            type="button"
            aria-label={`Play ${v.title}`}
            onClick={() => play(i)}
            className="relative h-12 w-[85px] shrink-0 overflow-hidden rounded-md bg-[var(--color-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]"
          >
            {v.thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            )}
            <span className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <Play className="h-5 w-5 text-white" />
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">
              {v.title}
              {/* dimming alone is invisible to assistive tech */}
              {unavailable && <span className="sr-only"> ({v.availabilityStatus})</span>}
            </div>
            <div className="truncate text-xs text-[var(--color-fg-muted)]">{v.channelTitle}</div>
          </div>
          <DownloadDuo
            videoId={v.id}
            canDownload={v.availabilityStatus === "available" || v.availabilityStatus === "unknown"}
            audio={slotForKind(v.availableKinds, "audio")}
            video={slotForKind(v.availableKinds, "video")}
            onMutate={() => mutate()}
          />
          <div className="hidden w-14 text-right font-mono text-xs tabular-nums text-[var(--color-fg-muted)] md:block">
            <Duration seconds={v.durationSeconds} />
          </div>
        </div>
        );
      })}
    </div>
  );
}
