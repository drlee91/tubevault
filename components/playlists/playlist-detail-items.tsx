"use client";

import { usePlaylistDetail } from "@/lib/client/use-playlist-detail";
import { TrackTable } from "./track-table";
import { ItemFilterChips } from "./item-filter-chips";
import { ErrorCard } from "@/components/shared/error-card";
import type { PlaylistDetailDto } from "@/lib/services/playlist-service";

export function PlaylistDetailItems({
  playlistId,
  initialData,
}: {
  playlistId: number;
  initialData: PlaylistDetailDto;
}) {
  const { data, error, mutate } = usePlaylistDetail(playlistId, { fallbackData: initialData });
  if (error) return <ErrorCard title="Couldn't refresh" message={error.message} onRetry={() => mutate()} />;
  if (!data) return null;
  return (
    <div className="space-y-4">
      <ItemFilterChips />
      <TrackTable items={data.items} defaultFormat={data.playlist.defaultFormat} />
    </div>
  );
}
