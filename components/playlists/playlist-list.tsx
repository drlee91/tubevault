import { EmptyState } from "@/components/shared/empty-state";
import { PlaylistCard } from "./playlist-card";
import { ListMusic } from "lucide-react";
import type { PlaylistStatsRow } from "@/lib/services/playlist-service";

export function PlaylistList({ items }: { items: PlaylistStatsRow[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={ListMusic}
        title="No playlists yet"
        description="Add your first playlist to get started."
      />
    );
  }
  return (
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
      {items.map((p) => <PlaylistCard key={p.id} p={p} />)}
    </div>
  );
}
