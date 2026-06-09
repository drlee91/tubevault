import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as schema from "@/lib/db/schema";
import type { PlaylistRepo } from "@/lib/db/repositories/playlist-repo";
import type { VideoRepo } from "@/lib/db/repositories/video-repo";
import type { PlaylistItemRepo } from "@/lib/db/repositories/playlist-item-repo";
import type { SyncRunRepo } from "@/lib/db/repositories/sync-run-repo";
import type { JobQueue } from "@/lib/jobs/queue";
import type { ProviderRegistry } from "@/lib/providers/registry";
import type { ProviderId } from "@/lib/providers/types";

export class PlaylistAlreadySyncingError extends Error {
  constructor(public readonly playlistId: number) {
    super(`playlist ${playlistId} already syncing`);
    this.name = "PlaylistAlreadySyncingError";
  }
}

export interface SyncResult {
  syncRunId: number;
  status: "success" | "partial" | "failed";
  stats: { added: number; removed: number; unchanged: number; unavailable: number };
}

export interface SyncServiceDeps {
  db: BetterSQLite3Database<typeof schema>;
  playlistRepo: PlaylistRepo;
  videoRepo: VideoRepo;
  itemRepo: PlaylistItemRepo;
  syncRunRepo: SyncRunRepo;
  registry: ProviderRegistry;
  queue: JobQueue;
}

export class SyncService {
  constructor(private readonly d: SyncServiceDeps) {}

  async sync(
    playlistId: number,
    triggeredBy: "manual" | "schedule" | "startup",
  ): Promise<SyncResult> {
    if (this.d.syncRunRepo.findRunning(playlistId)) {
      throw new PlaylistAlreadySyncingError(playlistId);
    }
    const playlist = this.d.playlistRepo.byId(playlistId);
    if (!playlist) throw new Error(`playlist ${playlistId} not found`);
    const provider = playlist.provider as ProviderId;
    const adapter = this.d.registry.findById(provider);
    if (!adapter) throw new Error(`no adapter for provider ${provider}`);

    const syncRunId = this.d.syncRunRepo.startRun({ playlistId, triggeredBy });
    const stats = { added: 0, removed: 0, unchanged: 0, unavailable: 0 };
    let status: SyncResult["status"] = "success";
    const errorLog: Array<{ videoId?: number; code: string; message: string; timestamp: Date }> = [];
    const enqueueQueue: Array<{ videoId: number; kind: "audio" | "video" }> = [];

    try {
      // Network call is OUTSIDE the transaction — must not hold SQLite lock for 5+ seconds
      const fetched = await adapter.fetchPlaylist(playlist.url);

      this.d.db.transaction(() => {
        const known = new Set(this.d.itemRepo.activeExternalIdsByPlaylist(playlistId));
        const current = new Set(fetched.items.map((i) => i.externalId));
        const added = [...current].filter((x) => !known.has(x));
        const removed = [...known].filter((x) => !current.has(x));
        const unchanged = [...current].filter((x) => known.has(x));

        for (let pos = 0; pos < fetched.items.length; pos++) {
          const item = fetched.items[pos]!;
          const videoId = this.d.videoRepo.upsert({
            provider,
            externalId: item.externalId,
            title: item.title,
            channelTitle: item.channelTitle,
            durationSeconds: item.durationSeconds,
            thumbnailUrl: item.thumbnailUrl,
            availabilityStatus: item.inferredStatus,
          });
          this.d.itemRepo.upsertActive(playlistId, videoId, pos);
          if (item.inferredStatus !== "available") stats.unavailable++;
          if (added.includes(item.externalId) && item.inferredStatus === "available") {
            // Dual-format policy: every item gets both an audio and a video file.
            // playlist.defaultFormat is a playback preference only.
            enqueueQueue.push({ videoId, kind: "audio" });
            enqueueQueue.push({ videoId, kind: "video" });
          }
        }
        for (const externalId of removed) {
          const v = this.d.videoRepo.byProviderExternalId(provider, externalId);
          if (v) this.d.itemRepo.markRemoved(playlistId, v.id);
        }
        if (fetched.title) {
          this.d.playlistRepo.updateMetadata(playlistId, {
            title: fetched.title,
            channelTitle: fetched.channelTitle,
          });
        }
        this.d.playlistRepo.touchLastSyncedAt(playlistId);
        stats.added = added.length;
        stats.removed = removed.length;
        stats.unchanged = unchanged.length;
      });

      // Enqueue happens AFTER transaction commits
      for (const e of enqueueQueue) {
        await this.d.queue.enqueue("download_video", e, { priority: 5 });
      }
    } catch (err) {
      status = "failed";
      errorLog.push({
        code: "SYNC_FAILED",
        message: err instanceof Error ? err.message : String(err),
        timestamp: new Date(),
      });
    }

    this.d.syncRunRepo.finishRun(syncRunId, { status, stats, errorLog });
    return { syncRunId, status, stats };
  }

  /**
   * Queue downloads for every playlist item that has no media file in the
   * playlist's default format yet. Sync only auto-downloads items that are
   * NEW since the previous run, so items whose downloads failed (or never
   * ran) would otherwise stay undownloaded forever.
   */
  async downloadMissing(playlistId: number): Promise<{ queued: number }> {
    const playlist = this.d.playlistRepo.byId(playlistId);
    if (!playlist) throw new Error(`playlist ${playlistId} not found`);
    const kind = playlist.defaultFormat;
    const items = this.d.itemRepo.listWithJoinsForDetail(playlistId);
    let queued = 0;
    for (const item of items) {
      if (!item.inPlaylist) continue;
      const status = item.video.availabilityStatus;
      if (status !== "available" && status !== "unknown") continue;
      if (kind === "audio" ? item.audioFile : item.videoFile) continue;
      const job = item.pendingJob;
      if (job && job.type === "download_video" && (job.status === "queued" || job.status === "running")) {
        continue; // already on its way
      }
      await this.d.queue.enqueue("download_video", { videoId: item.video.id, kind }, { priority: 5 });
      queued++;
    }
    return { queued };
  }
}
