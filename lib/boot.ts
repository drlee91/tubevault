import { runMigrations } from "@/lib/db/migrate";
import { getDb } from "@/lib/db/client";
import { SettingsRepository } from "@/lib/db/repositories/settings-repo";
import { PlaylistRepo } from "@/lib/db/repositories/playlist-repo";
import { VideoRepo } from "@/lib/db/repositories/video-repo";
import { PlaylistItemRepo } from "@/lib/db/repositories/playlist-item-repo";
import { MediaFileRepo } from "@/lib/db/repositories/media-file-repo";
import { SyncRunRepo } from "@/lib/db/repositories/sync-run-repo";
import { JobRepo } from "@/lib/db/repositories/job-repo";
import { SettingsService } from "@/lib/services/settings-service";
import { SelfCheckService } from "@/lib/services/self-check-service";
import { ProviderRegistry } from "@/lib/providers/registry";
import { YouTubeAdapter } from "@/lib/providers/youtube/adapter";
import { JobQueue } from "@/lib/jobs/queue";
import { WorkerPool } from "@/lib/jobs/worker";
import { SyncService } from "@/lib/services/sync-service";
import { DownloadService, type DownloadServiceSettings } from "@/lib/services/download-service";
import { PlaylistService } from "@/lib/services/playlist-service";
import { VideoService } from "@/lib/services/video-service";
import { SyncPlaylistHandler } from "@/lib/jobs/handlers/sync-playlist";
import { DownloadVideoHandler } from "@/lib/jobs/handlers/download-video";
import { CheckAvailabilityHandler } from "@/lib/jobs/handlers/check-availability";
import type { JobHandler, JobType } from "@/lib/jobs/types";

export interface BootContext {
  dbPath: string;
  settingsService: SettingsService;
  selfCheckService: SelfCheckService;
  registry: ProviderRegistry;
  queue: JobQueue;
  jobRepo: JobRepo;
  workerPool: WorkerPool;
  syncService: SyncService;
  downloadService: DownloadService;
  playlistService: PlaylistService;
  videoService: VideoService;
  mediaFileRepo: MediaFileRepo;
}

// Cache the boot promise rather than a boolean. A failed migration leaves the
// promise rejected, so subsequent awaiters see the real error instead of a
// silent successful resolve. See plan-1-followups.md F10 for context.
let bootPromise: Promise<BootContext> | null = null;

export function ensureBooted(): Promise<BootContext> {
  if (!bootPromise) bootPromise = doBoot();
  return bootPromise;
}

export function resetBootForTests(): void {
  bootPromise = null;
}

function coerceAudioFormat(f: string): "mp3" | "m4a" | "opus" | "flac" {
  if (f === "m4a" || f === "opus" || f === "flac") return f;
  return "mp3"; // map "best" or any unknown to mp3
}

function coerceAudioBitrate(b: string): number {
  const n = parseInt(b, 10);
  return Number.isFinite(n) ? n : 192; // "vbr" → 192
}

function coerceVideoQuality(q: string): "720p" | "1080p" | "1440p" | "2160p" | "best" {
  if (q === "720p" || q === "1080p" || q === "1440p" || q === "2160p" || q === "best") return q;
  return "1080p"; // 480p or unknown → 1080p
}

async function doBoot(): Promise<BootContext> {
  const dbPath = process.env.TUBEVAULT_DB_PATH ?? "./data/tubevault.db";
  await runMigrations({ dbPath, migrationsFolder: "./drizzle/migrations" });
  const db = getDb(dbPath);

  const settingsRepo = new SettingsRepository(db);
  const settingsService = new SettingsService(settingsRepo);

  const playlistRepo = new PlaylistRepo(db);
  const videoRepo = new VideoRepo(db);
  const itemRepo = new PlaylistItemRepo(db);
  const mediaRepo = new MediaFileRepo(db);
  const syncRunRepo = new SyncRunRepo(db);
  const jobRepo = new JobRepo(db);

  const selfCheckService = new SelfCheckService({
    ytdlpPath: settingsService.getYtdlpPath() ?? process.env.TUBEVAULT_YTDLP_PATH ?? "yt-dlp",
    ffmpegPath: settingsService.getFfmpegPath() ?? process.env.TUBEVAULT_FFMPEG_PATH ?? "ffmpeg",
    audioStoragePath: settingsService.getAudioStoragePath(),
    videoStoragePath: settingsService.getVideoStoragePath(),
    dbPath,
  });

  const registry = new ProviderRegistry();
  registry.register(
    new YouTubeAdapter({
      binary: settingsService.getYtdlpPath() ?? process.env.TUBEVAULT_YTDLP_PATH ?? "yt-dlp",
    }),
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
      defaultAudioFormat: coerceAudioFormat(settingsService.getDefaultAudioFormat()),
      defaultAudioBitrate: coerceAudioBitrate(settingsService.getDefaultAudioBitrate()),
      defaultVideoQuality: coerceVideoQuality(settingsService.getDefaultVideoQuality()),
    }),
  });

  const playlistService = new PlaylistService({ playlistRepo, itemRepo, syncRunRepo, queue, registry });
  const videoService = new VideoService({ videoRepo, queue, registry });

  const handlers = new Map<JobType, JobHandler>([
    ["sync_playlist", new SyncPlaylistHandler(syncService)],
    ["download_video", new DownloadVideoHandler(downloadService, videoRepo)],
    ["check_availability", new CheckAvailabilityHandler(registry, videoRepo)],
  ]);
  const workerPool = new WorkerPool(queue, handlers, {
    maxConcurrency: settingsService.getConcurrency(),
  });
  queue.attachWorker(workerPool);
  workerPool.start();

  return {
    dbPath,
    settingsService,
    selfCheckService,
    registry,
    queue,
    jobRepo,
    workerPool,
    syncService,
    downloadService,
    playlistService,
    videoService,
    mediaFileRepo: mediaRepo,
  };
}

if (typeof window === "undefined" && process.env.NODE_ENV !== "test") {
  void ensureBooted().catch((err) => {
    console.error("[tubevault:boot] startup failed:", err);
  });
}
