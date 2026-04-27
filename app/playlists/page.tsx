import { ensureBooted } from "@/lib/boot";
import { PlaylistList } from "@/components/playlists/playlist-list";
import { PlaylistsTabs } from "@/components/playlists/playlists-tabs";
import { StandaloneList } from "@/components/playlists/standalone-list";

export default async function PlaylistsPage() {
  const ctx = await ensureBooted();
  const items = ctx.playlistService.listWithStats();
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Playlists</h1>
      </header>
      <PlaylistsTabs
        playlists={<PlaylistList items={items} />}
        standalone={<StandaloneList />}
      />
    </div>
  );
}
