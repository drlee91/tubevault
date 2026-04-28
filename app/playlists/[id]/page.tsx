import { notFound } from "next/navigation";
import { ensureBooted } from "@/lib/boot";
import { PlaylistDetailHeader } from "@/components/playlists/playlist-detail-header";
import { PlaylistDetailItems } from "@/components/playlists/playlist-detail-items";
import { EmptyState } from "@/components/shared/empty-state";
import { ListMusic } from "lucide-react";

export default async function PlaylistDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await ensureBooted();
  const detail = ctx.playlistService.getDetailFull(Number(id));
  if (!detail) notFound();
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PlaylistDetailHeader
        playlist={detail.playlist}
        items={detail.items}
        defaultFormat={detail.playlist.defaultFormat as "audio" | "video"}
      />
      {detail.items.length === 0 ? (
        <EmptyState
          icon={ListMusic}
          title="Syncing…"
          description="First tracks will appear shortly."
        />
      ) : (
        <PlaylistDetailItems playlistId={detail.playlist.id} initialData={detail} />
      )}
    </div>
  );
}
