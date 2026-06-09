"use client";

import {
  useStandaloneVideos,
  type VideoSerialized,
} from "@/lib/client/use-standalone-videos";
import { Card, CardContent } from "@/components/ui/card";
import { StatusPill } from "@/components/shared/status-pill";
import { Duration } from "@/components/shared/duration";
import { RelativeTime } from "@/components/shared/relative-time";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorCard } from "@/components/shared/error-card";
import { SkeletonRow } from "@/components/shared/skeleton-row";
import { NowPlayingIndicator } from "@/components/player/now-playing-indicator";
import { Video } from "lucide-react";
import { usePlayerStoreApiOptional } from "@/lib/client/use-player-store";
import { useSyncExternalStore } from "react";
import { fromStandaloneVideos } from "@/lib/player/queue-from-items";
import { buildQueue } from "@/lib/player/queue-build";

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
    <div className="space-y-2">
      {data.videos.map((v: VideoSerialized, i: number) => (
        <Card key={v.id}>
          <CardContent className="flex items-center gap-3 p-3">
            <button
              type="button"
              aria-label={`Play ${v.title}`}
              onClick={() => play(i)}
              className="flex w-6 items-center justify-center"
            >
              {currentVideoId === v.id
                ? <NowPlayingIndicator isPlaying={isPlaying} />
                : <span className="text-xs text-[var(--color-fg-muted)]">{i + 1}</span>}
            </button>
            <span className="min-w-0 flex-1 truncate text-sm">{v.title}</span>
            <span className="text-xs text-[var(--color-fg-muted)]">{v.channelTitle}</span>
            <Duration seconds={v.durationSeconds} />
            <StatusPill status={v.availabilityStatus} />
            <span className="text-xs text-[var(--color-fg-muted)]">
              <RelativeTime iso={v.createdAt} />
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
