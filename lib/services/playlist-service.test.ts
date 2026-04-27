import { describe, it, expect } from "vitest";
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

      // Seed one media_file (audio) for v1 only — so downloadedItems = 1
      ctx.mediaFileRepo.insert({
        videoId: v1,
        kind: "audio",
        filePath: "/tmp/v1.mp3",
        format: "mp3",
        quality: "192",
        fileSizeBytes: 1024,
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
