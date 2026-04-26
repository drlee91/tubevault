import { sql } from "drizzle-orm";
import { sqliteTable, integer, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

// ---------- Provider enum (informational; SQLite stores as TEXT) ----------
export const PROVIDERS = ["youtube", "soundcloud"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const AVAILABILITY_STATUSES = [
  "available",
  "private",
  "removed",
  "age_restricted",
  "region_blocked",
  "auth_required",
  "unknown",
] as const;
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

// ---------- playlists ----------
export const playlists = sqliteTable(
  "playlists",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    provider: text("provider").$type<Provider>().notNull(),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    channelTitle: text("channel_title"),
    url: text("url").notNull(),
    defaultFormat: text("default_format").$type<"audio" | "video">().notNull().default("audio"),
    formatOverrides: text("format_overrides", { mode: "json" }).$type<Record<string, unknown>>(),
    syncEnabled: integer("sync_enabled", { mode: "boolean" }).notNull().default(true),
    syncScheduleCron: text("sync_schedule_cron"),
    lastSyncedAt: integer("last_synced_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    providerExternalIdx: uniqueIndex("playlists_provider_external_id_uq").on(
      t.provider,
      t.externalId,
    ),
  }),
);

// ---------- videos ----------
export const videos = sqliteTable(
  "videos",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    provider: text("provider").$type<Provider>().notNull(),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    channelTitle: text("channel_title"),
    channelId: text("channel_id"),
    durationSeconds: integer("duration_seconds"),
    thumbnailUrl: text("thumbnail_url"),
    availabilityStatus: text("availability_status")
      .$type<AvailabilityStatus>()
      .notNull()
      .default("unknown"),
    availabilityReason: text("availability_reason"),
    availabilityChangedAt: integer("availability_changed_at", { mode: "timestamp" }),
    firstSeenAt: integer("first_seen_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    providerExternalIdx: uniqueIndex("videos_provider_external_id_uq").on(t.provider, t.externalId),
    statusIdx: index("videos_availability_status_idx").on(t.availabilityStatus),
  }),
);

// ---------- playlist_items ----------
export const playlistItems = sqliteTable(
  "playlist_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    playlistId: integer("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    videoId: integer("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    // Position is provider-reported ordering, treated as a hint not a unique key —
    // YouTube occasionally returns duplicate positions during transitional states.
    position: integer("position").notNull(),
    inPlaylist: integer("in_playlist", { mode: "boolean" }).notNull().default(true),
    removedFromPlaylistAt: integer("removed_from_playlist_at", { mode: "timestamp" }),
    addedAt: integer("added_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    playlistVideoIdx: uniqueIndex("playlist_items_playlist_video_uq").on(t.playlistId, t.videoId),
    playlistIdx: index("playlist_items_playlist_idx").on(t.playlistId),
  }),
);

// ---------- media_files ----------
export const mediaFiles = sqliteTable(
  "media_files",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    videoId: integer("video_id")
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"audio" | "video">().notNull(),
    filePath: text("file_path").notNull(),
    format: text("format").notNull(),
    quality: text("quality"),
    fileSizeBytes: integer("file_size_bytes"),
    durationSeconds: integer("duration_seconds"),
    checksum: text("checksum"),
    downloadedAt: integer("downloaded_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => ({
    videoKindIdx: uniqueIndex("media_files_video_kind_uq").on(t.videoId, t.kind),
  }),
);

// ---------- sync_runs ----------
export const syncRuns = sqliteTable("sync_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playlistId: integer("playlist_id").references(() => playlists.id, { onDelete: "cascade" }),
  startedAt: integer("started_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  finishedAt: integer("finished_at", { mode: "timestamp" }),
  status: text("status")
    .$type<"running" | "success" | "partial" | "failed">()
    .notNull()
    .default("running"),
  videosAdded: integer("videos_added").notNull().default(0),
  videosRemoved: integer("videos_removed").notNull().default(0),
  videosUnavailable: integer("videos_unavailable").notNull().default(0),
  videosDownloaded: integer("videos_downloaded").notNull().default(0),
  errorLog: text("error_log", { mode: "json" }).$type<unknown[]>(),
  triggeredBy: text("triggered_by")
    .$type<"manual" | "schedule" | "startup">()
    .notNull()
    .default("manual"),
});

// ---------- jobs ----------
export const jobs = sqliteTable(
  "jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    type: text("type").$type<"sync_playlist" | "download_video" | "check_availability">().notNull(),
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    status: text("status")
      .$type<"queued" | "running" | "completed" | "failed" | "cancelled">()
      .notNull()
      .default("queued"),
    priority: integer("priority").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    lastError: text("last_error"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    startedAt: integer("started_at", { mode: "timestamp" }),
    finishedAt: integer("finished_at", { mode: "timestamp" }),
    nextAttemptAt: integer("next_attempt_at", { mode: "timestamp" }),
  },
  (t) => ({
    statusPriorityIdx: index("jobs_status_priority_idx").on(t.status, t.priority),
  }),
);

// ---------- settings ----------
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(), // JSON-encoded
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// ---------- type exports ----------
export type Playlist = typeof playlists.$inferSelect;
export type NewPlaylist = typeof playlists.$inferInsert;

export type Video = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;

export type PlaylistItem = typeof playlistItems.$inferSelect;
export type NewPlaylistItem = typeof playlistItems.$inferInsert;

export type MediaFile = typeof mediaFiles.$inferSelect;
export type NewMediaFile = typeof mediaFiles.$inferInsert;

export type SyncRun = typeof syncRuns.$inferSelect;
export type NewSyncRun = typeof syncRuns.$inferInsert;

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;

export type SettingsRow = typeof settings.$inferSelect;
