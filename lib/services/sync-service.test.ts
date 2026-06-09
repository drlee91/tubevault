import { describe, it, expect } from "vitest";
import { createTestDb } from "@/lib/db/__tests__/test-db";
import { PlaylistRepo } from "@/lib/db/repositories/playlist-repo";
import { VideoRepo } from "@/lib/db/repositories/video-repo";
import { PlaylistItemRepo } from "@/lib/db/repositories/playlist-item-repo";
import { SyncRunRepo } from "@/lib/db/repositories/sync-run-repo";
import { MediaFileRepo } from "@/lib/db/repositories/media-file-repo";
import { JobRepo } from "@/lib/db/repositories/job-repo";
import { JobQueue } from "@/lib/jobs/queue";
import { ProviderRegistry } from "@/lib/providers/registry";
import { FakeAdapter } from "@/lib/providers/__tests__/fake-adapter";
import { SyncService, PlaylistAlreadySyncingError } from "./sync-service";
import type { PlaylistMetadata } from "@/lib/providers/types";

function setup() {
  const { db, sqlite } = createTestDb();
  const playlistRepo = new PlaylistRepo(db);
  const videoRepo = new VideoRepo(db);
  const itemRepo = new PlaylistItemRepo(db);
  const syncRunRepo = new SyncRunRepo(db);
  const jobRepo = new JobRepo(db);
  const queue = new JobQueue(db, jobRepo);
  const registry = new ProviderRegistry();
  return { db, sqlite, playlistRepo, videoRepo, itemRepo, syncRunRepo, jobRepo, queue, registry };
}

function pl(items: Array<{ id: string; title: string; status?: "available" | "removed" | "private" }>): PlaylistMetadata {
  return {
    externalId: "PL1",
    title: "Test",
    channelTitle: "C",
    url: "https://www.youtube.com/playlist?list=PL1",
    items: items.map((i) => ({
      externalId: i.id,
      title: i.title,
      channelTitle: "C",
      durationSeconds: 100,
      thumbnailUrl: null,
      inferredStatus: i.status ?? "available",
    })),
  };
}

describe("SyncService", () => {
  it("initial sync inserts playlist items, enqueues downloads for available added", async () => {
    const ctx = setup();
    try {
      const fake = new FakeAdapter({
        fetchPlaylist: pl([{ id: "v1", title: "T1" }, { id: "v2", title: "T2" }]),
      });
      ctx.registry.register(fake);
      const playlistId = ctx.playlistRepo.create({
        provider: "youtube",
        externalId: "PL1",
        url: "u",
        defaultFormat: "audio",
      });
      const svc = new SyncService(ctx);
      const result = await svc.sync(playlistId, "manual");
      expect(result.status).toBe("success");
      expect(result.stats.added).toBe(2);
      expect(ctx.itemRepo.activeExternalIdsByPlaylist(playlistId).sort()).toEqual(["v1", "v2"]);
      expect(ctx.jobRepo.countByStatus().queued).toBe(4);
    } finally {
      ctx.sqlite.close();
    }
  });

  it("re-sync marks removed videos and does not enqueue downloads for them", async () => {
    const ctx = setup();
    try {
      const playlistId = ctx.playlistRepo.create({
        provider: "youtube", externalId: "PL1", url: "u", defaultFormat: "audio",
      });
      const adapter = new FakeAdapter({
        fetchPlaylist: pl([{ id: "v1", title: "T" }, { id: "v2", title: "T" }]),
      });
      ctx.registry.register(adapter);
      const svc = new SyncService(ctx);
      await svc.sync(playlistId, "manual");
      expect(ctx.jobRepo.countByStatus().queued).toBe(4);

      adapter.script.fetchPlaylist = pl([{ id: "v1", title: "T" }]);
      const second = await svc.sync(playlistId, "manual");
      expect(second.stats.removed).toBe(1);
      expect(ctx.itemRepo.activeExternalIdsByPlaylist(playlistId)).toEqual(["v1"]);
      expect(ctx.jobRepo.countByStatus().queued).toBe(4);
    } finally {
      ctx.sqlite.close();
    }
  });

  it("does not enqueue downloads for items inferred as removed", async () => {
    const ctx = setup();
    try {
      const playlistId = ctx.playlistRepo.create({
        provider: "youtube", externalId: "PL1", url: "u", defaultFormat: "audio",
      });
      ctx.registry.register(new FakeAdapter({
        fetchPlaylist: pl([
          { id: "ok", title: "OK", status: "available" },
          { id: "del", title: "[Deleted video]", status: "removed" },
        ]),
      }));
      const svc = new SyncService(ctx);
      await svc.sync(playlistId, "manual");
      expect(ctx.jobRepo.countByStatus().queued).toBe(2);
    } finally {
      ctx.sqlite.close();
    }
  });

  it("throws PlaylistAlreadySyncingError when an active run exists", async () => {
    const ctx = setup();
    try {
      const playlistId = ctx.playlistRepo.create({
        provider: "youtube", externalId: "PL1", url: "u", defaultFormat: "audio",
      });
      ctx.syncRunRepo.startRun({ playlistId, triggeredBy: "manual" });
      ctx.registry.register(new FakeAdapter({ fetchPlaylist: pl([]) }));
      const svc = new SyncService(ctx);
      await expect(svc.sync(playlistId, "manual")).rejects.toBeInstanceOf(PlaylistAlreadySyncingError);
    } finally {
      ctx.sqlite.close();
    }
  });
});

describe("downloadMissing", () => {
  function seedVideo(
    ctx: ReturnType<typeof setup>,
    playlistId: number,
    externalId: string,
    position: number,
    status: "available" | "unknown" | "removed",
  ): number {
    const id = ctx.videoRepo.upsert({
      provider: "youtube", externalId, title: externalId, channelTitle: null,
      durationSeconds: 1, thumbnailUrl: null, availabilityStatus: status,
    });
    ctx.itemRepo.upsertActive(playlistId, id, position);
    return id;
  }

  it("queues default-format downloads only for items without a file, skipping undownloadable and already-queued", async () => {
    const ctx = setup();
    try {
      const mediaRepo = new MediaFileRepo(ctx.db);
      const playlistId = ctx.playlistRepo.create({
        provider: "youtube", externalId: "PL1", url: "u", defaultFormat: "audio",
      });
      seedVideo(ctx, playlistId, "v-available", 0, "available");
      seedVideo(ctx, playlistId, "v-unknown", 1, "unknown");
      const withFile = seedVideo(ctx, playlistId, "v-has-file", 2, "available");
      seedVideo(ctx, playlistId, "v-removed", 3, "removed");
      mediaRepo.insert({
        videoId: withFile, kind: "audio", filePath: "/x/a.mp3",
        format: "mp3", quality: "192", fileSizeBytes: 1, durationSeconds: 1,
      });

      const svc = new SyncService(ctx);
      const first = await svc.downloadMissing(playlistId);
      expect(first.queued).toBe(2); // available + unknown, not has-file/removed
      expect(ctx.jobRepo.countByStatus().queued).toBe(2);

      // Second invocation must not duplicate the still-queued jobs.
      const second = await svc.downloadMissing(playlistId);
      expect(second.queued).toBe(0);
      expect(ctx.jobRepo.countByStatus().queued).toBe(2);
    } finally {
      ctx.sqlite.close();
    }
  });
});
