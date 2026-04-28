import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import * as schema from "@/lib/db/schema";
import { ProviderRegistry } from "@/lib/providers/registry";
import { JobQueue } from "@/lib/jobs/queue";
import { WorkerPool } from "@/lib/jobs/worker";
import { SettingsRepository } from "@/lib/db/repositories/settings-repo";
import { PlaylistRepo } from "@/lib/db/repositories/playlist-repo";
import { VideoRepo } from "@/lib/db/repositories/video-repo";
import { PlaylistItemRepo } from "@/lib/db/repositories/playlist-item-repo";
import { MediaFileRepo } from "@/lib/db/repositories/media-file-repo";
import { SyncRunRepo } from "@/lib/db/repositories/sync-run-repo";
import { JobRepo } from "@/lib/db/repositories/job-repo";
import { SettingsService } from "@/lib/services/settings-service";
import { SelfCheckService } from "@/lib/services/self-check-service";
import { PlaylistService } from "@/lib/services/playlist-service";
import { VideoService } from "@/lib/services/video-service";
import { MediaFileService } from "@/lib/services/media-file-service";
import { SyncService } from "@/lib/services/sync-service";
import { DownloadService, type DownloadServiceSettings } from "@/lib/services/download-service";
import { SyncPlaylistHandler } from "@/lib/jobs/handlers/sync-playlist";
import { DownloadVideoHandler } from "@/lib/jobs/handlers/download-video";
import type { MediaProviderAdapter, ProviderId, PlaylistMetadata, VideoMetadata, DownloadOpts, DownloadResult, AvailabilityProbe } from "@/lib/providers/types";
import type { JobType, JobHandler } from "@/lib/jobs/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

// ---------------------------------------------------------------------------
// Fake YouTube adapter — used in tests so no real yt-dlp calls are made.
// ---------------------------------------------------------------------------
export class FakeYouTubeAdapter implements MediaProviderAdapter {
  readonly provider: ProviderId = "youtube";

  matchesUrl(url: string): boolean {
    return url.includes("youtube.com") || url.includes("youtu.be");
  }

  parseUrl(url: string): { kind: "playlist" | "video"; externalId: string } | null {
    const playlistMatch = url.match(/[?&]list=([^&]+)/);
    if (playlistMatch) return { kind: "playlist", externalId: playlistMatch[1]! };
    const videoMatch = url.match(/[?&]v=([^&]+)/);
    if (videoMatch) return { kind: "video", externalId: videoMatch[1]! };
    return null;
  }

  async fetchPlaylist(url: string): Promise<PlaylistMetadata> {
    const parsed = this.parseUrl(url);
    const externalId = parsed?.externalId ?? "FAKE_PLAYLIST";
    return {
      externalId,
      title: "Fake Playlist",
      channelTitle: "Fake Channel",
      url,
      items: [],
    };
  }

  async fetchVideo(url: string): Promise<VideoMetadata> {
    const parsed = this.parseUrl(url);
    const externalId = parsed?.externalId ?? "FAKE_VIDEO";
    return {
      externalId,
      title: "Fake Video",
      channelTitle: "Fake Channel",
      channelId: null,
      durationSeconds: 120,
      thumbnailUrl: null,
      inferredStatus: "available",
      description: null,
      uploadDate: null,
      availabilityReason: null,
    };
  }

  async download(_externalId: string, opts: DownloadOpts): Promise<DownloadResult> {
    return {
      filePath: `${opts.outputDir}/${opts.filenameStem}.mp3`,
      format: opts.audioFormat ?? "mp3",
      quality: "192",
      fileSizeBytes: 0,
      durationSeconds: 120,
    };
  }

  async checkAvailability(_externalId: string): Promise<AvailabilityProbe> {
    return { status: "available", reason: null };
  }
}

// ---------------------------------------------------------------------------
// FakeYouTubeAdapterWithItems — extends FakeYouTubeAdapter to return 2 fake
// playlist items, used when withHandlers=true for E2E tests.
// ---------------------------------------------------------------------------
export class FakeYouTubeAdapterWithItems extends FakeYouTubeAdapter {
  override async fetchPlaylist(url: string): Promise<PlaylistMetadata> {
    const base = await super.fetchPlaylist(url);
    return {
      ...base,
      items: [
        {
          externalId: "FAKE_VIDEO_1",
          title: "Fake Video 1",
          channelTitle: "Fake Channel",
          durationSeconds: 120,
          thumbnailUrl: null,
          inferredStatus: "available",
        },
        {
          externalId: "FAKE_VIDEO_2",
          title: "Fake Video 2",
          channelTitle: "Fake Channel",
          durationSeconds: 180,
          thumbnailUrl: null,
          inferredStatus: "available",
        },
      ],
    };
  }
}

// ---------------------------------------------------------------------------
// TestBootContext — mirrors BootContext in lib/boot.ts exactly.
// ---------------------------------------------------------------------------
export interface TestBootContext {
  dbPath: string;
  db: BetterSQLite3Database<typeof schema>;
  settingsService: SettingsService;
  selfCheckService: SelfCheckService;
  registry: ProviderRegistry;
  queue: JobQueue;
  workerPool: WorkerPool;
  syncService: SyncService;
  downloadService: DownloadService;
  playlistService: PlaylistService;
  videoService: VideoService;
  mediaFileService: MediaFileService;
  // Individual repos exposed for test seeding
  playlistRepo: PlaylistRepo;
  videoRepo: VideoRepo;
  itemRepo: PlaylistItemRepo;
  mediaFileRepo: MediaFileRepo;
  syncRunRepo: SyncRunRepo;
  jobRepo: JobRepo;
  cleanup: () => void;
}

export interface CreateTestBootContextOptions {
  /** When true, wires SyncPlaylistHandler + DownloadVideoHandler into WorkerPool
   *  and registers FakeYouTubeAdapterWithItems (returns 2 fake playlist items).
   *  Defaults to false — existing tests are unaffected. */
  withHandlers?: boolean;
}

export async function createTestBootContext(
  opts: CreateTestBootContextOptions = {},
): Promise<TestBootContext> {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  const migrationsFolder = path.join(process.cwd(), "drizzle/migrations");
  migrate(db, { migrationsFolder });

  const dbPath = ":memory:";

  const settingsRepo = new SettingsRepository(db);
  const settingsService = new SettingsService(settingsRepo);

  const playlistRepo = new PlaylistRepo(db);
  const videoRepo = new VideoRepo(db);
  const itemRepo = new PlaylistItemRepo(db);
  const mediaRepo = new MediaFileRepo(db);
  const syncRunRepo = new SyncRunRepo(db);
  const jobRepo = new JobRepo(db);

  const selfCheckService = new SelfCheckService({
    ytdlpPath: "yt-dlp",
    ffmpegPath: "ffmpeg",
    audioStoragePath: settingsService.getAudioStoragePath(),
    videoStoragePath: settingsService.getVideoStoragePath(),
    dbPath,
  });

  const registry = new ProviderRegistry();
  registry.register(
    opts.withHandlers ? new FakeYouTubeAdapterWithItems() : new FakeYouTubeAdapter(),
  );

  const queue = new JobQueue(db, jobRepo);
  await queue.resetStaleRunning();

  const syncService = new SyncService({
    db,
    playlistRepo,
    videoRepo,
    itemRepo,
    syncRunRepo,
    registry,
    queue,
  });

  const downloadService = new DownloadService({
    videoRepo,
    mediaRepo,
    registry,
    settings: (): DownloadServiceSettings => ({
      audioStoragePath: settingsService.getAudioStoragePath(),
      videoStoragePath: settingsService.getVideoStoragePath(),
      useSingleStoragePath: settingsService.getUseSingleStoragePath(),
      defaultAudioFormat: "mp3",
      defaultAudioBitrate: 192,
      defaultVideoQuality: "1080p",
    }),
  });

  const playlistService = new PlaylistService({ playlistRepo, itemRepo, syncRunRepo, mediaFileRepo: mediaRepo, queue, registry });
  const videoService = new VideoService({ videoRepo, queue, registry });
  const mediaFileService = new MediaFileService({ mediaFileRepo: mediaRepo });

  // Worker pool: when withHandlers=true, real handlers are wired so the drain
  // helper can process jobs. Pool is NOT started (no setInterval), so jobs only
  // run when explicitly drained. When withHandlers=false the pool has no handlers
  // and is not wired to the queue — existing tests are unaffected.
  let workerPool: WorkerPool;
  if (opts.withHandlers) {
    const handlerMap = new Map<JobType, JobHandler>([
      ["sync_playlist", new SyncPlaylistHandler(syncService)],
      ["download_video", new DownloadVideoHandler(downloadService, videoRepo)],
    ]);
    workerPool = new WorkerPool(queue, handlerMap, { maxConcurrency: 1 });
  } else {
    workerPool = new WorkerPool(queue, new Map(), { maxConcurrency: 1 });
  }

  return {
    dbPath,
    db,
    settingsService,
    selfCheckService,
    registry,
    queue,
    workerPool,
    syncService,
    downloadService,
    playlistService,
    videoService,
    mediaFileService,
    playlistRepo,
    videoRepo,
    itemRepo,
    mediaFileRepo: mediaRepo,
    syncRunRepo,
    jobRepo,
    cleanup: () => sqlite.close(),
  };
}
