import { PlaylistsPageSkeleton } from "@/components/shared/page-skeletons";

// Root-level fallback. The dashboard route is `/playlists`, so the playlists
// skeleton mirrors the next layout the user is most likely to land on.
export default function Loading() {
  return <PlaylistsPageSkeleton />;
}
