"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { TrackRow } from "./track-row";
import type { PlaylistDetailItem } from "@/lib/services/playlist-service";

export function TrackTable({ items }: { items: PlaylistDetailItem[] }) {
  const sp = useSearchParams();
  const filter = sp.get("filter") ?? "all";
  const [q, setQ] = useState("");

  const filtered = items.filter((it) => {
    if (!it.inPlaylist) return false;
    if (filter === "available" && it.video.availabilityStatus !== "available") return false;
    if (filter === "unavailable" && it.video.availabilityStatus === "available") return false;
    if (q && !it.video.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search items"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
      </div>
      <div className="space-y-1">
        {filtered.map((it, i) => <TrackRow key={it.video.id} item={it} position={i} />)}
      </div>
      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-[var(--color-muted)]">No items match.</p>
      )}
    </div>
  );
}
