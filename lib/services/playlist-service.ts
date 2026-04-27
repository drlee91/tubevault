import type { PlaylistRepo, PlaylistRow, PlaylistStatsRow } from "@/lib/db/repositories/playlist-repo";
import type { PlaylistItemRepo, PlaylistDetailItem } from "@/lib/db/repositories/playlist-item-repo";
import type { SyncRunRepo } from "@/lib/db/repositories/sync-run-repo";
import type { MediaFileRepo } from "@/lib/db/repositories/media-file-repo";
import type { JobQueue } from "@/lib/jobs/queue";
import type { ProviderRegistry } from "@/lib/providers/registry";

export type { PlaylistStatsRow, PlaylistDetailItem };

export interface PlaylistDetailDto {
  playlist: PlaylistStatsRow;
  items: PlaylistDetailItem[];
  recentSyncRuns: Array<{
    id: number;
    startedAt: string;
    finishedAt: string | null;
    status: string;
    videosAdded: number;
    videosRemoved: number;
    videosUnavailable: number;
    videosDownloaded: number;
    triggeredBy: string;
    errorLog: unknown;
  }>;
}

export class ProviderUnsupportedError extends Error {
  constructor(public readonly url: string) {
    super(`no provider for ${url}`);
    this.name = "ProviderUnsupportedError";
  }
}

export class UrlNotPlaylistError extends Error {
  constructor(public readonly url: string) {
    super(`url is not a playlist: ${url}`);
    this.name = "UrlNotPlaylistError";
  }
}

export class PlaylistAlreadyTrackedError extends Error {
  constructor(public readonly playlistId: number) {
    super(`playlist already tracked: ${playlistId}`);
    this.name = "PlaylistAlreadyTrackedError";
  }
}

export interface CreatePlaylistInput {
  url: string;
  defaultFormat: "audio" | "video";
}

export interface RecentActivityItem {
  id: number;
  playlistId: number;
  playlistTitle: string;
  status: "running" | "success" | "partial" | "failed";
  videosAdded: number;
  videosRemoved: number;
  videosUnavailable: number;
  finishedAt: string | null;
  triggeredBy: string;
}

export interface DashboardStats {
  playlists: number;
  trackedVideos: number;
  availablePct: number;
  diskBytes: number;
}

export interface PlaylistServiceDeps {
  playlistRepo: PlaylistRepo;
  itemRepo: PlaylistItemRepo;
  syncRunRepo?: SyncRunRepo;
  mediaFileRepo?: MediaFileRepo;
  queue: JobQueue;
  registry: ProviderRegistry;
}

export class PlaylistService {
  constructor(private readonly d: PlaylistServiceDeps) {}

  async create(input: CreatePlaylistInput): Promise<{ playlist: PlaylistRow; syncJobId: number }> {
    const adapter = this.d.registry.findByUrl(input.url);
    if (!adapter) throw new ProviderUnsupportedError(input.url);
    const parsed = adapter.parseUrl(input.url);
    if (!parsed || parsed.kind !== "playlist") throw new UrlNotPlaylistError(input.url);
    const existing = this.d.playlistRepo.byProviderExternalId(adapter.provider, parsed.externalId);
    if (existing) throw new PlaylistAlreadyTrackedError(existing.id);
    const id = this.d.playlistRepo.create({
      provider: adapter.provider,
      externalId: parsed.externalId,
      url: input.url,
      defaultFormat: input.defaultFormat,
    });
    const playlist = this.d.playlistRepo.byId(id)!;
    const syncJobId = await this.d.queue.enqueue(
      "sync_playlist",
      { playlistId: id },
      { priority: 10 },
    );
    return { playlist, syncJobId };
  }

  list(): PlaylistRow[] {
    return this.d.playlistRepo.list();
  }

  byId(id: number): PlaylistRow | null {
    return this.d.playlistRepo.byId(id);
  }

  async delete(id: number): Promise<void> {
    this.d.itemRepo.deleteByPlaylist(id);
    this.d.playlistRepo.delete(id);
  }

  listWithStats(): PlaylistStatsRow[] {
    return this.d.playlistRepo.listWithStats();
  }

  dashboardStats(): DashboardStats {
    const playlists = this.d.playlistRepo.list().length;

    // Count DISTINCT video_id in playlist_items WHERE in_playlist = 1
    const trackedRows = this.d.itemRepo.countTrackedVideos();
    const trackedVideos = trackedRows.tracked;
    const availableTracked = trackedRows.available;

    const availablePct =
      trackedVideos === 0 ? 100 : Math.round((availableTracked / trackedVideos) * 100);

    let diskBytes = 0;
    if (this.d.mediaFileRepo) {
      const usage = this.d.mediaFileRepo.usageByKind();
      diskBytes = usage.audio.totalBytes + usage.video.totalBytes;
    }

    return { playlists, trackedVideos, availablePct, diskBytes };
  }

  recentActivity(limit: number): RecentActivityItem[] {
    if (!this.d.syncRunRepo) return [];
    const rows = this.d.syncRunRepo.recentWithPlaylist(limit);
    return rows.map((r) => ({
      id: r.run.id,
      playlistId: r.run.playlistId ?? 0,
      playlistTitle: r.playlistTitle ?? "(deleted playlist)",
      status: r.run.status,
      videosAdded: r.run.videosAdded,
      videosRemoved: r.run.videosRemoved,
      videosUnavailable: r.run.videosUnavailable,
      finishedAt:
        r.run.finishedAt != null
          ? r.run.finishedAt instanceof Date
            ? r.run.finishedAt.toISOString()
            : String(r.run.finishedAt)
          : null,
      triggeredBy: r.run.triggeredBy,
    }));
  }

  getDetailFull(id: number): PlaylistDetailDto | null {
    const playlist = this.d.playlistRepo.byIdWithStats(id);
    if (!playlist) return null;
    const items = this.d.itemRepo.listWithJoinsForDetail(id);
    const recentSyncRuns = this.d.syncRunRepo
      ? this.d.syncRunRepo.recentByPlaylist(id, 10).map((r) => ({
          id: r.id,
          startedAt: r.startedAt instanceof Date ? r.startedAt.toISOString() : String(r.startedAt),
          finishedAt: r.finishedAt != null
            ? (r.finishedAt instanceof Date ? r.finishedAt.toISOString() : String(r.finishedAt))
            : null,
          status: r.status,
          videosAdded: r.videosAdded,
          videosRemoved: r.videosRemoved,
          videosUnavailable: r.videosUnavailable,
          videosDownloaded: r.videosDownloaded,
          triggeredBy: r.triggeredBy,
          errorLog: r.errorLog,
        }))
      : [];
    return { playlist, items, recentSyncRuns };
  }
}
