"use client";

import { useSearchParams } from "next/navigation";
import { useDeferredValue, useState } from "react";
import { Input } from "@/components/ui/input";
import { TrackRow } from "./track-row";
import type { PlaylistDetailItem } from "@/lib/services/playlist-service";
import { usePlayerStore, usePlayerStoreApi } from "@/lib/client/use-player-store";
import { fromPlaylistDetailItems } from "@/lib/player/queue-from-items";
import { buildQueue } from "@/lib/player/queue-build";

interface Props { items: PlaylistDetailItem[]; defaultFormat: "audio" | "video"; }

export function TrackTable({ items, defaultFormat }: Props) {
  const sp = useSearchParams();
  const filter = sp.get("filter") ?? "all";
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const store = usePlayerStoreApi();
  const currentVideoId = usePlayerStore((s) => (s.currentIndex >= 0 ? s.queue[s.currentIndex]?.videoId : undefined));
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const needle = deferredQ.toLowerCase();
  const filtered = items.filter((it) => {
    if (!it.inPlaylist) return false;
    if (filter === "available" && it.video.availabilityStatus !== "available") return false;
    if (filter === "unavailable" && it.video.availabilityStatus === "available") return false;
    if (needle && !it.video.title.toLowerCase().includes(needle)) return false;
    return true;
  });

  function play(index: number) {
    const queueItems = fromPlaylistDetailItems(filtered, defaultFormat);
    const built = buildQueue(queueItems, index);
    store.getState().setQueue(built.queue, built.currentIndex);
    store.getState().play();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Input
          aria-label="Search items"
          placeholder="Search items"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
      </div>
      <div className="space-y-1">
        {filtered.map((it, i) => (
          <TrackRow
            key={it.video.id}
            item={it}
            position={i}
            onPlay={() => play(i)}
            isCurrent={currentVideoId === it.video.id}
            isPlaying={currentVideoId === it.video.id && isPlaying}
            defaultFormat={defaultFormat}
          />
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-[var(--color-muted)]">No items match.</p>
      )}
    </div>
  );
}
