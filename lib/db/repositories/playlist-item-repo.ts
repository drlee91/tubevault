import { eq, and, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { playlistItems, videos } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import { rawTimestampToIso, rawTimestampToIsoOrNull } from "./raw-timestamp";

export interface PlaylistDetailItem {
  position: number;
  inPlaylist: boolean;
  addedAt: string;
  removedFromPlaylistAt: string | null;
  video: {
    id: number;
    externalId: string;
    title: string;
    channelTitle: string | null;
    durationSeconds: number | null;
    thumbnailUrl: string | null;
    availabilityStatus: string;
    availabilityReason: string | null;
  };
  audioFile: { id: number; format: string; quality: string; fileSizeBytes: number; downloadedAt: string } | null;
  videoFile: { id: number; format: string; quality: string; fileSizeBytes: number; downloadedAt: string } | null;
  pendingJob: { id: number; type: string; status: string; attempts: number; lastError: string | null } | null;
  availableKinds: Array<"audio" | "video">;
}

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

  countTrackedVideos(): { tracked: number; available: number } {
    const row = this.db.get<{ tracked: number; available: number }>(sql`
      SELECT
        COUNT(DISTINCT pi.video_id) AS tracked,
        COUNT(DISTINCT CASE WHEN v.availability_status = 'available' THEN pi.video_id END) AS available
      FROM playlist_items pi
      JOIN videos v ON v.id = pi.video_id
      WHERE pi.in_playlist = 1
    `);
    return {
      tracked: Number(row?.tracked ?? 0),
      available: Number(row?.available ?? 0),
    };
  }

  listWithJoinsForDetail(playlistId: number): PlaylistDetailItem[] {
    const rows = this.db.all(sql`
      SELECT
        pi.position, pi.in_playlist, pi.added_at, pi.removed_from_playlist_at,
        v.id AS v_id, v.external_id, v.title, v.channel_title, v.duration_seconds,
        v.thumbnail_url, v.availability_status, v.availability_reason,
        ma.id AS audio_id, ma.format AS audio_format, ma.quality AS audio_quality,
        ma.file_size_bytes AS audio_size, ma.downloaded_at AS audio_downloaded,
        mv.id AS video_file_id, mv.format AS video_format, mv.quality AS video_quality,
        mv.file_size_bytes AS video_size, mv.downloaded_at AS video_downloaded,
        j.id AS job_id, j.type AS job_type, j.status AS job_status, j.attempts AS job_attempts, j.last_error AS job_last_error
      FROM playlist_items pi
      JOIN videos v ON v.id = pi.video_id
      LEFT JOIN media_files ma ON ma.video_id = v.id AND ma.kind = 'audio'
      LEFT JOIN media_files mv ON mv.video_id = v.id AND mv.kind = 'video'
      LEFT JOIN jobs j ON j.id = (
        SELECT j2.id FROM jobs j2
        WHERE json_extract(j2.payload, '$.videoId') = v.id
          AND j2.status IN ('queued', 'running', 'failed')
        ORDER BY j2.created_at DESC
        LIMIT 1
      )
      WHERE pi.playlist_id = ${playlistId}
      ORDER BY pi.position ASC
    `) as Record<string, unknown>[];

    return rows.map((r): PlaylistDetailItem => ({
      position: r["position"] as number,
      inPlaylist: Boolean(r["in_playlist"]),
      addedAt: rawTimestampToIso(r["added_at"]),
      removedFromPlaylistAt: rawTimestampToIsoOrNull(r["removed_from_playlist_at"]),
      video: {
        id: r["v_id"] as number,
        externalId: r["external_id"] as string,
        title: r["title"] as string,
        channelTitle: r["channel_title"] as string | null,
        durationSeconds: r["duration_seconds"] != null ? Number(r["duration_seconds"]) : null,
        thumbnailUrl: r["thumbnail_url"] as string | null,
        availabilityStatus: r["availability_status"] as string,
        availabilityReason: r["availability_reason"] as string | null,
      },
      audioFile: r["audio_id"] != null
        ? {
            id: Number(r["audio_id"]),
            format: r["audio_format"] as string,
            quality: r["audio_quality"] as string,
            fileSizeBytes: Number(r["audio_size"]),
            downloadedAt: rawTimestampToIso(r["audio_downloaded"]),
          }
        : null,
      videoFile: r["video_file_id"] != null
        ? {
            id: Number(r["video_file_id"]),
            format: r["video_format"] as string,
            quality: r["video_quality"] as string,
            fileSizeBytes: Number(r["video_size"]),
            downloadedAt: rawTimestampToIso(r["video_downloaded"]),
          }
        : null,
      pendingJob: r["job_id"] != null
        ? {
            id: Number(r["job_id"]),
            type: r["job_type"] as string,
            status: r["job_status"] as string,
            attempts: Number(r["job_attempts"]),
            lastError: r["job_last_error"] as string | null,
          }
        : null,
      availableKinds: (() => {
        const kinds: Array<"audio" | "video"> = [];
        if (r["audio_id"] != null) kinds.push("audio");
        if (r["video_file_id"] != null) kinds.push("video");
        return kinds;
      })(),
    }));
  }
}
