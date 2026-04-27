"use client";

import { useStandaloneVideos } from "@/lib/client/use-standalone-videos";
import { Card, CardContent } from "@/components/ui/card";
import { StatusPill } from "@/components/shared/status-pill";
import { Duration } from "@/components/shared/duration";
import { RelativeTime } from "@/components/shared/relative-time";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorCard } from "@/components/shared/error-card";
import { SkeletonRow } from "@/components/shared/skeleton-row";
import type { VideoRow } from "@/lib/db/repositories/video-repo";
import { Video } from "lucide-react";

export function StandaloneList() {
  const { data, error, mutate, isLoading } = useStandaloneVideos();
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
  return (
    <div className="space-y-2">
      {data.videos.map((v: VideoRow) => (
        <Card key={v.id}>
          <CardContent className="flex items-center gap-3 p-3">
            <span className="flex-1 truncate text-sm">{v.title}</span>
            <span className="text-xs text-[var(--color-muted)]">{v.channelTitle}</span>
            <Duration seconds={v.durationSeconds} />
            <StatusPill status={v.availabilityStatus} />
            <span className="text-xs text-[var(--color-muted)]">
              <RelativeTime iso={new Date(v.createdAt).toISOString()} />
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
