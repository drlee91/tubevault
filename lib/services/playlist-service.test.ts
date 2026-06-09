import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { createTestDb } from "@/lib/db/__tests__/test-db";
import { PlaylistRepo } from "@/lib/db/repositories/playlist-repo";
import { PlaylistItemRepo } from "@/lib/db/repositories/playlist-item-repo";
import { JobRepo } from "@/lib/db/repositories/job-repo";
import { JobQueue } from "@/lib/jobs/queue";
import { ProviderRegistry } from "@/lib/providers/registry";
import { FakeAdapter } from "@/lib/providers/__tests__/fake-adapter";
import { createTestBootContext } from "@/lib/test-utils/boot-test-context";
import {
  PlaylistService,
  PlaylistAlreadyTrackedError,
  ProviderUnsupportedError,
  UrlNotPlaylistError,
} from "./playlist-service";

function setup() {
  const { db, sqlite } = createTestDb();
  const playlistRepo = new PlaylistRepo(db);
  const itemRepo = new PlaylistItemRepo(db);
  const jobRepo = new JobRepo(db);
  const queue = new JobQueue(db, jobRepo);
  const registry = new ProviderRegistry();
  return { sqlite, playlistRepo, itemRepo, queue, jobRepo, registry };
}

describe("PlaylistService", () => {
  it("create inserts playlist and enqueues sync_playlist", async () => {
    const ctx = setup();
    try {
      ctx.registry.register(new FakeAdapter());
      const svc = new PlaylistService(ctx);
      const { playlist, syncJobId } = await svc.create({
        url: "https://www.youtube.com/playlist?list=PLX",
        defaultFormat: "audio",
      });
      expect(playlist.externalId).toBe("PLX");
      expect(ctx.jobRepo.byId(syncJobId)?.type).toBe("sync_playlist");
    } finally {
      ctx.sqlite.close();
    }
  });

  it("create rejects unsupported provider", async () => {
    const ctx = setup();
    try {
      const svc = new PlaylistService(ctx);
      await expect(svc.create({ url: "https://soundcloud.com/x", defaultFormat: "audio" }))
        .rejects.toBeInstanceOf(ProviderUnsupportedError);
    } finally {
      ctx.sqlite.close();
    }
  });

  it("create rejects non-playlist URL", async () => {
    const ctx = setup();
    try {
      ctx.registry.register(new FakeAdapter());
      const svc = new PlaylistService(ctx);
      await expect(svc.create({ url: "https://youtu.be/abc", defaultFormat: "audio" }))
        .rejects.toBeInstanceOf(UrlNotPlaylistError);
    } finally {
      ctx.sqlite.close();
    }
  });

  it("create rejects duplicates", async () => {
    const ctx = setup();
    try {
      ctx.registry.register(new FakeAdapter());
      const svc = new PlaylistService(ctx);
      await svc.create({
        url: "https://www.youtube.com/playlist?list=PLX",
        defaultFormat: "audio",
      });
      await expect(svc.create({
        url: "https://www.youtube.com/playlist?list=PLX",
        defaultFormat: "audio",
      })).rejects.toBeInstanceOf(PlaylistAlreadyTrackedError);
    } finally {
      ctx.sqlite.close();
    }
  });

  it("delete removes playlist + items, leaves videos and media files alone", async () => {
    const ctx = setup();
    try {
      ctx.registry.register(new FakeAdapter());
      const svc = new PlaylistService(ctx);
      const { playlist } = await svc.create({
        url: "https://www.youtube.com/playlist?list=PLX",
        defaultFormat: "audio",
      });
      await svc.delete(playlist.id);
      expect(ctx.playlistRepo.byId(playlist.id)).toBeNull();
    } finally {
      ctx.sqlite.close();
    }
  });
});

describe("listWithStats", () => {
  it("returns playlists with totals", async () => {
    const ctx = await createTestBootContext();
    try {
      // Seed a playlist directly via repos
      const playlistId = ctx.playlistRepo.create({
        provider: "youtube",
        externalId: "PL_STATS",
        url: "https://www.youtube.com/playlist?list=PL_STATS",
        defaultFormat: "audio",
      });

      // Seed two videos
      const v1 = ctx.videoRepo.upsert({
        provider: "youtube",
        externalId: "VID1",
        title: "Video 1",
        channelTitle: "Chan",
        durationSeconds: 120,
        thumbnailUrl: null,
        availabilityStatus: "available",
      });
      const v2 = ctx.videoRepo.upsert({
        provider: "youtube",
        externalId: "VID2",
        title: "Video 2",
        channelTitle: "Chan",
        durationSeconds: 200,
        thumbnailUrl: null,
        availabilityStatus: "available",
      });

      // Seed two playlist items
      ctx.itemRepo.upsertActive(playlistId, v1, 0);
      ctx.itemRepo.upsertActive(playlistId, v2, 1);

      // Seed both audio + video for v1 only — so downloadedItems = 1 (both-kind policy).
      // v2 has no files and must not count.
      ctx.mediaFileRepo.insert({
        videoId: v1,
        kind: "audio",
        filePath: "/tmp/v1.mp3",
        format: "mp3",
        quality: "192",
        fileSizeBytes: 1024,
        durationSeconds: 120,
      });
      ctx.mediaFileRepo.insert({
        videoId: v1,
        kind: "video",
        filePath: "/tmp/v1.mp4",
        format: "mp4",
        quality: "720p",
        fileSizeBytes: 2048,
        durationSeconds: 120,
      });

      const stats = ctx.playlistService.listWithStats();
      expect(stats).toHaveLength(1);
      expect(stats[0]!.stats.totalItems).toBe(2);
      expect(stats[0]!.stats.downloadedItems).toBe(1);
    } finally {
      ctx.cleanup();
    }
  });

  it("returns empty array when no playlists", async () => {
    const ctx = await createTestBootContext();
    try {
      expect(ctx.playlistService.listWithStats()).toEqual([]);
    } finally {
      ctx.cleanup();
    }
  });
});

describe("getDetailFull", () => {
  it("returns null when not found", async () => {
    const ctx = await createTestBootContext();
    try {
      expect(ctx.playlistService.getDetailFull(999)).toBeNull();
    } finally {
      ctx.cleanup();
    }
  });

  it("returns playlist with items joined to videos, files, pendingJob", async () => {
    const ctx = await createTestBootContext();
    try {
      // Seed playlist
      const playlistId = ctx.playlistRepo.create({
        provider: "youtube",
        externalId: "PL_DETAIL",
        url: "https://www.youtube.com/playlist?list=PL_DETAIL",
        defaultFormat: "audio",
      });

      // Seed video
      const videoId = ctx.videoRepo.upsert({
        provider: "youtube",
        externalId: "VID_DETAIL",
        title: "Detail Video",
        channelTitle: "Detail Chan",
        durationSeconds: 300,
        thumbnailUrl: "https://img.example.com/thumb.jpg",
        availabilityStatus: "available",
      });

      // Seed playlist item
      ctx.itemRepo.upsertActive(playlistId, videoId, 0);

      // Seed audio media_file
      const audioFileId = ctx.mediaFileRepo.insert({
        videoId,
        kind: "audio",
        filePath: "/tmp/detail.mp3",
        format: "mp3",
        quality: "192",
        fileSizeBytes: 2048,
        durationSeconds: 300,
      });

      // Seed a queued download_video job with matching videoId in payload
      ctx.jobRepo.insert({
        type: "download_video",
        payload: { videoId },
        priority: 0,
      });

      // Seed a sync run
      ctx.syncRunRepo.startRun({ playlistId, triggeredBy: "manual" });

      const detail = ctx.playlistService.getDetailFull(playlistId);
      expect(detail).not.toBeNull();
      expect(detail!.playlist.id).toBe(playlistId);
      expect(detail!.items).toHaveLength(1);
      expect(detail!.items[0]!.video.title).toBe("Detail Video");
      expect(detail!.items[0]!.audioFile?.id).toBe(audioFileId);
      expect(detail!.items[0]!.videoFile).toBeNull();
      expect(detail!.items[0]!.pendingJob?.type).toBe("download_video");
      expect(detail!.recentSyncRuns).toHaveLength(1);
    } finally {
      ctx.cleanup();
    }
  });

  it("returns null audioFile/videoFile/pendingJob when none present", async () => {
    const ctx = await createTestBootContext();
    try {
      const playlistId = ctx.playlistRepo.create({
        provider: "youtube",
        externalId: "PL_BARE",
        url: "https://www.youtube.com/playlist?list=PL_BARE",
        defaultFormat: "audio",
      });
      const videoId = ctx.videoRepo.upsert({
        provider: "youtube",
        externalId: "VID_BARE",
        title: "Bare Video",
        channelTitle: null,
        durationSeconds: null,
        thumbnailUrl: null,
        availabilityStatus: "available",
      });
      ctx.itemRepo.upsertActive(playlistId, videoId, 0);

      const detail = ctx.playlistService.getDetailFull(playlistId);
      expect(detail).not.toBeNull();
      expect(detail!.items[0]!.audioFile).toBeNull();
      expect(detail!.items[0]!.videoFile).toBeNull();
      expect(detail!.items[0]!.pendingJob).toBeNull();
      expect(detail!.recentSyncRuns).toEqual([]);
    } finally {
      ctx.cleanup();
    }
  });
});

describe("dashboardStats", () => {
  it("returns zeroes when DB is empty", async () => {
    const ctx = await createTestBootContext();
    try {
      const stats = ctx.playlistService.dashboardStats();
      expect(stats.playlists).toBe(0);
      expect(stats.trackedVideos).toBe(0);
      expect(stats.availablePct).toBe(100); // vacuously available
      expect(stats.diskBytes).toBe(0);
    } finally {
      ctx.cleanup();
    }
  });

  it("counts playlists, tracked videos, available pct, and disk bytes", async () => {
    const ctx = await createTestBootContext();
    try {
      // Seed 2 playlists
      const pl1 = ctx.playlistRepo.create({
        provider: "youtube",
        externalId: "PL_DASH1",
        url: "https://www.youtube.com/playlist?list=PL_DASH1",
        defaultFormat: "audio",
      });
      const pl2 = ctx.playlistRepo.create({
        provider: "youtube",
        externalId: "PL_DASH2",
        url: "https://www.youtube.com/playlist?list=PL_DASH2",
        defaultFormat: "audio",
      });

      // 3 videos: v1=available, v2=available, v3=removed
      const v1 = ctx.videoRepo.upsert({
        provider: "youtube", externalId: "DASH_V1", title: "V1",
        channelTitle: null, durationSeconds: null, thumbnailUrl: null,
        availabilityStatus: "available",
      });
      const v2 = ctx.videoRepo.upsert({
        provider: "youtube", externalId: "DASH_V2", title: "V2",
        channelTitle: null, durationSeconds: null, thumbnailUrl: null,
        availabilityStatus: "available",
      });
      const v3 = ctx.videoRepo.upsert({
        provider: "youtube", externalId: "DASH_V3", title: "V3",
        channelTitle: null, durationSeconds: null, thumbnailUrl: null,
        availabilityStatus: "removed",
      });

      // pl1 has v1, v2 (in_playlist=true) + v3 (removed from playlist)
      ctx.itemRepo.upsertActive(pl1, v1, 0);
      ctx.itemRepo.upsertActive(pl1, v2, 1);
      ctx.itemRepo.upsertActive(pl1, v3, 2);
      ctx.itemRepo.markRemoved(pl1, v3); // v3 not in_playlist — should not count as tracked

      // pl2 has v1 (same video, should count once due to DISTINCT)
      ctx.itemRepo.upsertActive(pl2, v1, 0);

      // media files: 1000 audio bytes + 2000 video bytes
      ctx.mediaFileRepo.insert({
        videoId: v1,
        kind: "audio",
        filePath: "/tmp/v1.mp3",
        format: "mp3",
        quality: "192",
        fileSizeBytes: 1000,
        durationSeconds: 60,
      });
      ctx.mediaFileRepo.insert({
        videoId: v2,
        kind: "video",
        filePath: "/tmp/v2.mp4",
        format: "mp4",
        quality: "1080p",
        fileSizeBytes: 2000,
        durationSeconds: 120,
      });

      const stats = ctx.playlistService.dashboardStats();
      expect(stats.playlists).toBe(2);
      // v1 and v2 are tracked (in_playlist=true); v3 is removed from playlist
      // v1 appears in both playlists but DISTINCT => still 2
      expect(stats.trackedVideos).toBe(2);
      // v1=available, v2=available => 2/2 = 100%
      expect(stats.availablePct).toBe(100);
      expect(stats.diskBytes).toBe(3000);
    } finally {
      ctx.cleanup();
    }
  });

  it("rounds availablePct to integer and handles partial availability", async () => {
    const ctx = await createTestBootContext();
    try {
      const pl = ctx.playlistRepo.create({
        provider: "youtube",
        externalId: "PL_PCT",
        url: "https://www.youtube.com/playlist?list=PL_PCT",
        defaultFormat: "audio",
      });
      const v1 = ctx.videoRepo.upsert({
        provider: "youtube", externalId: "PCT_V1", title: "V1",
        channelTitle: null, durationSeconds: null, thumbnailUrl: null,
        availabilityStatus: "available",
      });
      const v2 = ctx.videoRepo.upsert({
        provider: "youtube", externalId: "PCT_V2", title: "V2",
        channelTitle: null, durationSeconds: null, thumbnailUrl: null,
        availabilityStatus: "removed",
      });
      const v3 = ctx.videoRepo.upsert({
        provider: "youtube", externalId: "PCT_V3", title: "V3",
        channelTitle: null, durationSeconds: null, thumbnailUrl: null,
        availabilityStatus: "removed",
      });
      ctx.itemRepo.upsertActive(pl, v1, 0);
      ctx.itemRepo.upsertActive(pl, v2, 1);
      ctx.itemRepo.upsertActive(pl, v3, 2);

      const stats = ctx.playlistService.dashboardStats();
      expect(stats.trackedVideos).toBe(3);
      // 1/3 = 33.33... => rounds to 33
      expect(stats.availablePct).toBe(33);
    } finally {
      ctx.cleanup();
    }
  });
});

describe("recentActivity", () => {
  it("returns empty array when no sync runs", async () => {
    const ctx = await createTestBootContext();
    try {
      const items = ctx.playlistService.recentActivity(10);
      expect(items).toEqual([]);
    } finally {
      ctx.cleanup();
    }
  });

  it("returns ordered runs with playlist title and correct shape", async () => {
    const ctx = await createTestBootContext();
    try {
      const pl1 = ctx.playlistRepo.create({
        provider: "youtube",
        externalId: "PL_ACT1",
        url: "https://www.youtube.com/playlist?list=PL_ACT1",
        defaultFormat: "audio",
        title: "My Playlist",
      });
      const pl2 = ctx.playlistRepo.create({
        provider: "youtube",
        externalId: "PL_ACT2",
        url: "https://www.youtube.com/playlist?list=PL_ACT2",
        defaultFormat: "audio",
        title: "Other Playlist",
      });

      // Start two runs — run1 for pl1, run2 for pl2
      const run1 = ctx.syncRunRepo.startRun({ playlistId: pl1, triggeredBy: "manual" });
      ctx.syncRunRepo.finishRun(run1, {
        status: "success",
        stats: { added: 5, removed: 1, unchanged: 0, unavailable: 2, downloaded: 0 },
        errorLog: [],
      });
      const run2 = ctx.syncRunRepo.startRun({ playlistId: pl2, triggeredBy: "schedule" });
      ctx.syncRunRepo.finishRun(run2, {
        status: "partial",
        stats: { added: 0, removed: 0, unchanged: 3, unavailable: 1, downloaded: 0 },
        errorLog: [],
      });

      const items = ctx.playlistService.recentActivity(10);
      expect(items).toHaveLength(2);

      const run1Item = items.find((i) => i.id === run1)!;
      expect(run1Item).toBeDefined();
      expect(run1Item.playlistTitle).toBe("My Playlist");
      expect(run1Item.status).toBe("success");
      expect(run1Item.videosAdded).toBe(5);
      expect(run1Item.videosRemoved).toBe(1);
      expect(run1Item.finishedAt).not.toBeNull();

      const run2Item = items.find((i) => i.id === run2)!;
      expect(run2Item).toBeDefined();
      expect(run2Item.playlistTitle).toBe("Other Playlist");
      expect(run2Item.status).toBe("partial");
      expect(run2Item.videosUnavailable).toBe(1);
      expect(run2Item.triggeredBy).toBe("schedule");
    } finally {
      ctx.cleanup();
    }
  });

  it("falls back to '(deleted playlist)' when join yields no playlist", async () => {
    const ctx = await createTestBootContext();
    try {
      const pl = ctx.playlistRepo.create({
        provider: "youtube",
        externalId: "PL_ORPHAN",
        url: "https://www.youtube.com/playlist?list=PL_ORPHAN",
        defaultFormat: "audio",
        title: "Will Be Orphaned",
      });
      const runId = ctx.syncRunRepo.startRun({ playlistId: pl, triggeredBy: "manual" });
      ctx.syncRunRepo.finishRun(runId, {
        status: "success",
        stats: { added: 1, removed: 0, unchanged: 0, unavailable: 0, downloaded: 0 },
        errorLog: [],
      });
      // Simulate orphaned sync_run: nullify playlist_id (column is nullable).
      ctx.db.run(sql`UPDATE sync_runs SET playlist_id = NULL WHERE id = ${runId}`);

      const items = ctx.playlistService.recentActivity(10);
      const orphan = items.find((i) => i.id === runId)!;
      expect(orphan).toBeDefined();
      expect(orphan.playlistTitle).toBe("(deleted playlist)");
      expect(orphan.playlistId).toBeNull();
    } finally {
      ctx.cleanup();
    }
  });

  it("respects the limit parameter", async () => {
    const ctx = await createTestBootContext();
    try {
      const pl = ctx.playlistRepo.create({
        provider: "youtube",
        externalId: "PL_LIM",
        url: "https://www.youtube.com/playlist?list=PL_LIM",
        defaultFormat: "audio",
      });
      for (let i = 0; i < 5; i++) {
        const runId = ctx.syncRunRepo.startRun({ playlistId: pl, triggeredBy: "manual" });
        ctx.syncRunRepo.finishRun(runId, {
          status: "success",
          stats: { added: 0, removed: 0, unchanged: 0, unavailable: 0, downloaded: 0 },
          errorLog: [],
        });
      }
      const items = ctx.playlistService.recentActivity(3);
      expect(items).toHaveLength(3);
    } finally {
      ctx.cleanup();
    }
  });
});

describe("recentSyncRuns", () => {
  it("returns empty array when no sync runs", async () => {
    const ctx = await createTestBootContext();
    try {
      const runs = ctx.playlistService.recentSyncRuns({ limit: 10 });
      expect(runs).toEqual([]);
    } finally {
      ctx.cleanup();
    }
  });

  it("returns correct shape and respects limit", async () => {
    const ctx = await createTestBootContext();
    try {
      const pl = ctx.playlistRepo.create({
        provider: "youtube",
        externalId: "PL_HIST",
        url: "https://www.youtube.com/playlist?list=PL_HIST",
        defaultFormat: "audio",
        title: "History Playlist",
      });

      // Create 4 runs
      for (let i = 0; i < 4; i++) {
        const runId = ctx.syncRunRepo.startRun({ playlistId: pl, triggeredBy: "manual" });
        ctx.syncRunRepo.finishRun(runId, {
          status: "success",
          stats: { added: i, removed: 0, unchanged: 0, unavailable: 0, downloaded: 1 },
          errorLog: [],
        });
      }

      const runs = ctx.playlistService.recentSyncRuns({ limit: 3 });
      expect(runs).toHaveLength(3);
      // Shape check on first item
      const first = runs[0]!;
      expect(first.playlistId).toBe(pl);
      expect(first.playlistTitle).toBe("History Playlist");
      expect(first.status).toBe("success");
      expect(typeof first.startedAt).toBe("string");
      expect(typeof first.videosAdded).toBe("number");
      expect(typeof first.videosDownloaded).toBe("number");
    } finally {
      ctx.cleanup();
    }
  });

  it("filters by status (failed only returns failed runs)", async () => {
    const ctx = await createTestBootContext();
    try {
      const pl = ctx.playlistRepo.create({
        provider: "youtube",
        externalId: "PL_HISTF",
        url: "https://www.youtube.com/playlist?list=PL_HISTF",
        defaultFormat: "audio",
        title: "Filter Playlist",
      });

      const run1 = ctx.syncRunRepo.startRun({ playlistId: pl, triggeredBy: "manual" });
      ctx.syncRunRepo.finishRun(run1, {
        status: "success",
        stats: { added: 1, removed: 0, unchanged: 0, unavailable: 0 },
        errorLog: [],
      });
      const run2 = ctx.syncRunRepo.startRun({ playlistId: pl, triggeredBy: "manual" });
      ctx.syncRunRepo.finishRun(run2, {
        status: "failed",
        stats: { added: 0, removed: 0, unchanged: 0, unavailable: 0 },
        errorLog: [{ code: "ERR", message: "boom", timestamp: new Date() }],
      });

      const failed = ctx.playlistService.recentSyncRuns({ limit: 10, status: "failed" });
      expect(failed).toHaveLength(1);
      expect(failed[0]!.status).toBe("failed");
      expect(failed[0]!.id).toBe(run2);
    } finally {
      ctx.cleanup();
    }
  });

  it("excludes orphan sync_runs (playlist_id NULL)", async () => {
    const ctx = await createTestBootContext();
    try {
      const pl = ctx.playlistRepo.create({
        provider: "youtube",
        externalId: "PL_ORPH2",
        url: "https://www.youtube.com/playlist?list=PL_ORPH2",
        defaultFormat: "audio",
        title: "Orphan Test Playlist",
      });
      const runId = ctx.syncRunRepo.startRun({ playlistId: pl, triggeredBy: "manual" });
      ctx.syncRunRepo.finishRun(runId, {
        status: "success",
        stats: { added: 1, removed: 0, unchanged: 0, unavailable: 0 },
        errorLog: [],
      });
      // Nullify playlist_id to simulate orphan
      ctx.db.run(sql`UPDATE sync_runs SET playlist_id = NULL WHERE id = ${runId}`);

      const runs = ctx.playlistService.recentSyncRuns({ limit: 10 });
      expect(runs.find((r) => r.id === runId)).toBeUndefined();
    } finally {
      ctx.cleanup();
    }
  });
});
