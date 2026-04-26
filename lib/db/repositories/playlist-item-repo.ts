import { eq, and } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { playlistItems, videos } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";

export class PlaylistItemRepo {
  constructor(private readonly db: BetterSQLite3Database<typeof schema>) {}

  upsertActive(playlistId: number, videoId: number, position: number): void {
    const existing = this.db
      .select()
      .from(playlistItems)
      .where(and(eq(playlistItems.playlistId, playlistId), eq(playlistItems.videoId, videoId)))
      .get();
    if (existing) {
      this.db
        .update(playlistItems)
        .set({ position, inPlaylist: true, removedFromPlaylistAt: null })
        .where(eq(playlistItems.id, existing.id))
        .run();
    } else {
      this.db
        .insert(playlistItems)
        .values({ playlistId, videoId, position, inPlaylist: true, addedAt: new Date() })
        .run();
    }
  }

  markRemoved(playlistId: number, videoId: number): void {
    this.db
      .update(playlistItems)
      .set({ inPlaylist: false, removedFromPlaylistAt: new Date() })
      .where(and(eq(playlistItems.playlistId, playlistId), eq(playlistItems.videoId, videoId)))
      .run();
  }

  activeExternalIdsByPlaylist(playlistId: number): string[] {
    return this.db
      .select({ externalId: videos.externalId })
      .from(playlistItems)
      .innerJoin(videos, eq(playlistItems.videoId, videos.id))
      .where(and(eq(playlistItems.playlistId, playlistId), eq(playlistItems.inPlaylist, true)))
      .all()
      .map((r) => r.externalId);
  }

  listByPlaylist(playlistId: number) {
    return this.db
      .select()
      .from(playlistItems)
      .where(eq(playlistItems.playlistId, playlistId))
      .all();
  }

  deleteByPlaylist(playlistId: number): void {
    this.db.delete(playlistItems).where(eq(playlistItems.playlistId, playlistId)).run();
  }
}
