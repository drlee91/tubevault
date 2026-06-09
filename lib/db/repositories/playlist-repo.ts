import { eq, and, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { playlists } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import type { ProviderId } from "@/lib/providers/types";
import { rawTimestampToIso, rawTimestampToIsoOrNull } from "./raw-timestamp";

export interface PlaylistStatsRow {
  id: number;
  provider: "youtube";
  externalId: string;
  title: string | null;
  channelTitle: string | null;
  url: string;
  defaultFormat: "audio" | "video";
  syncEnabled: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
  stats: {
    totalItems: number;
    availableItems: number;
    unavailableItems: number;
    downloadedItems: number;
  };
  activeSyncRunId: number | null;
}

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

  private mapStatsRow(row: Record<string, unknown>): PlaylistStatsRow {
    return {
      id: row["id"] as number,
      provider: row["provider"] as "youtube",
      externalId: row["external_id"] as string,
      title: row["title"] as string | null,
      channelTitle: row["channel_title"] as string | null,
      url: row["url"] as string,
      defaultFormat: row["default_format"] as "audio" | "video",
      syncEnabled: Boolean(row["sync_enabled"]),
      lastSyncedAt: rawTimestampToIsoOrNull(row["last_synced_at"]),
      createdAt: rawTimestampToIso(row["created_at"]),
      stats: {
        totalItems: Number(row["total_items"]),
        availableItems: Number(row["available_items"]),
        unavailableItems: Number(row["unavailable_items"]),
        downloadedItems: Number(row["downloaded_items"]),
      },
      activeSyncRunId: row["active_sync_run_id"] != null ? Number(row["active_sync_run_id"]) : null,
    };
  }

  listWithStats(): PlaylistStatsRow[] {
    const rows = this.db.all(sql`
      SELECT
        p.*,
        (SELECT COUNT(*) FROM playlist_items pi WHERE pi.playlist_id = p.id AND pi.in_playlist = 1) AS total_items,
        (SELECT COUNT(*) FROM playlist_items pi
           JOIN videos v ON v.id = pi.video_id
           WHERE pi.playlist_id = p.id AND pi.in_playlist = 1 AND v.availability_status = 'available') AS available_items,
        (SELECT COUNT(*) FROM playlist_items pi
           JOIN videos v ON v.id = pi.video_id
           WHERE pi.playlist_id = p.id AND pi.in_playlist = 1 AND v.availability_status != 'available') AS unavailable_items,
        (SELECT COUNT(*) FROM playlist_items pi
           WHERE pi.playlist_id = p.id AND pi.in_playlist = 1
             AND EXISTS (SELECT 1 FROM media_files ma WHERE ma.video_id = pi.video_id AND ma.kind = 'audio')
             AND EXISTS (SELECT 1 FROM media_files mv WHERE mv.video_id = pi.video_id AND mv.kind = 'video')) AS downloaded_items,
        (SELECT id FROM sync_runs sr WHERE sr.playlist_id = p.id AND sr.status = 'running' LIMIT 1) AS active_sync_run_id
      FROM playlists p
      ORDER BY p.created_at DESC
    `) as Record<string, unknown>[];
    return rows.map((r) => this.mapStatsRow(r));
  }

  byIdWithStats(id: number): PlaylistStatsRow | null {
    const rows = this.db.all(sql`
      SELECT
        p.*,
        (SELECT COUNT(*) FROM playlist_items pi WHERE pi.playlist_id = p.id AND pi.in_playlist = 1) AS total_items,
        (SELECT COUNT(*) FROM playlist_items pi
           JOIN videos v ON v.id = pi.video_id
           WHERE pi.playlist_id = p.id AND pi.in_playlist = 1 AND v.availability_status = 'available') AS available_items,
        (SELECT COUNT(*) FROM playlist_items pi
           JOIN videos v ON v.id = pi.video_id
           WHERE pi.playlist_id = p.id AND pi.in_playlist = 1 AND v.availability_status != 'available') AS unavailable_items,
        (SELECT COUNT(*) FROM playlist_items pi
           WHERE pi.playlist_id = p.id AND pi.in_playlist = 1
             AND EXISTS (SELECT 1 FROM media_files ma WHERE ma.video_id = pi.video_id AND ma.kind = 'audio')
             AND EXISTS (SELECT 1 FROM media_files mv WHERE mv.video_id = pi.video_id AND mv.kind = 'video')) AS downloaded_items,
        (SELECT id FROM sync_runs sr WHERE sr.playlist_id = p.id AND sr.status = 'running' LIMIT 1) AS active_sync_run_id
      FROM playlists p
      WHERE p.id = ${id}
    `) as Record<string, unknown>[];
    return rows.length > 0 ? this.mapStatsRow(rows[0]!) : null;
  }
}
