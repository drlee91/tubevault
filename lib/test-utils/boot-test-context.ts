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
import { SyncService } from "@/lib/services/sync-service";
import { DownloadService, type DownloadServiceSettings } from "@/lib/services/download-service";
import type { MediaProviderAdapter, ProviderId, PlaylistMetadata, VideoMetadata, DownloadOpts, DownloadResult, AvailabilityProbe } from "@/lib/providers/types";
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
  // Individual repos exposed for test seeding
  playlistRepo: PlaylistRepo;
  videoRepo: VideoRepo;
  itemRepo: PlaylistItemRepo;
  mediaFileRepo: MediaFileRepo;
  syncRunRepo: SyncRunRepo;
  jobRepo: JobRepo;
  cleanup: () => void;
}

export async function createTestBootContext(): Promise<TestBootContext> {
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
  registry.register(new FakeYouTubeAdapter());

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

  const playlistService = new PlaylistService({ playlistRepo, itemRepo, syncRunRepo, queue, registry });
  const videoService = new VideoService({ videoRepo, queue, registry });

  // Worker pool created but NOT wired to the queue — tests must not process jobs.
  // Skipping queue.attachWorker() prevents the signal() path from dispatching and
  // failing enqueued jobs when no handlers are registered.
  const workerPool = new WorkerPool(queue, new Map(), { maxConcurrency: 1 });

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
    playlistRepo,
    videoRepo,
    itemRepo,
    mediaFileRepo: mediaRepo,
    syncRunRepo,
    jobRepo,
    cleanup: () => sqlite.close(),
  };
}
