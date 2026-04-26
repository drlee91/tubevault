import { eq, and } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { playlists } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import type { ProviderId } from "@/lib/providers/types";

export interface CreatePlaylistInput {
  provider: ProviderId;
  externalId: string;
  url: string;
  defaultFormat: "audio" | "video";
  title?: string | null;
  channelTitle?: string | null;
}

export type PlaylistRow = typeof playlists.$inferSelect;

export class PlaylistRepo {
  constructor(private readonly db: BetterSQLite3Database<typeof schema>) {}

  create(input: CreatePlaylistInput): number {
    const now = new Date();
    const [row] = this.db
      .insert(playlists)
      .values({
        provider: input.provider,
        externalId: input.externalId,
        url: input.url,
        defaultFormat: input.defaultFormat,
        title: input.title ?? "",
        channelTitle: input.channelTitle ?? null,
        syncEnabled: true,
        createdAt: now,
      })
      .returning({ id: playlists.id })
      .all();
    return row!.id;
  }

  byId(id: number): PlaylistRow | null {
    return this.db.select().from(playlists).where(eq(playlists.id, id)).get() ?? null;
  }

  byProviderExternalId(provider: ProviderId, externalId: string): PlaylistRow | null {
    return (
      this.db
        .select()
        .from(playlists)
        .where(and(eq(playlists.provider, provider), eq(playlists.externalId, externalId)))
        .get() ?? null
    );
  }

  list(): PlaylistRow[] {
    return this.db.select().from(playlists).all();
  }

  touchLastSyncedAt(id: number): void {
    this.db.update(playlists).set({ lastSyncedAt: new Date() }).where(eq(playlists.id, id)).run();
  }

  updateMetadata(
    id: number,
    fields: Partial<Pick<PlaylistRow, "title" | "channelTitle">>,
  ): void {
    this.db.update(playlists).set(fields).where(eq(playlists.id, id)).run();
  }

  delete(id: number): void {
    this.db.delete(playlists).where(eq(playlists.id, id)).run();
  }
}
