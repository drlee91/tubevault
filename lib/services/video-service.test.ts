import { describe, it, expect } from "vitest";
import { createTestDb } from "@/lib/db/__tests__/test-db";
import { VideoRepo } from "@/lib/db/repositories/video-repo";
import { JobRepo } from "@/lib/db/repositories/job-repo";
import { JobQueue } from "@/lib/jobs/queue";
import { ProviderRegistry } from "@/lib/providers/registry";
import { FakeAdapter } from "@/lib/providers/__tests__/fake-adapter";
import { VideoService, VideoAlreadyTrackedError, UrlNotVideoError, VideoNotFoundError } from "./video-service";
import { createTestBootContext } from "@/lib/test-utils/boot-test-context";

function setup() {
  const { db, sqlite } = createTestDb();
  const videoRepo = new VideoRepo(db);
  const jobRepo = new JobRepo(db);
  const queue = new JobQueue(db, jobRepo);
  const registry = new ProviderRegistry();
  return { sqlite, videoRepo, queue, jobRepo, registry };
}

describe("VideoService", () => {
  it("addStandalone synchronously fetches metadata, inserts, enqueues download", async () => {
    const ctx = setup();
    try {
      ctx.registry.register(new FakeAdapter({
        fetchVideo: {
          externalId: "vid1",
          title: "T",
          channelTitle: "C",
          channelId: "uc",
          durationSeconds: 100,
          thumbnailUrl: null,
          inferredStatus: "available",
          description: null,
          uploadDate: null,
          availabilityReason: null,
        },
      }));
      const svc = new VideoService(ctx);
      const { video, downloadJobIds } = await svc.addStandalone({
        url: "https://youtu.be/vid1",
      });
      expect(video.externalId).toBe("vid1");
      expect(downloadJobIds).toHaveLength(2);
      const kinds = downloadJobIds
        .map((id) => ctx.jobRepo.byId(id))
        .map((j) => (j!.payload as { kind: string }).kind)
        .sort();
      expect(kinds).toEqual(["audio", "video"]);
    } finally {
      ctx.sqlite.close();
    }
  });

  it("rejects non-video URLs", async () => {
    const ctx = setup();
    try {
      ctx.registry.register(new FakeAdapter());
      const svc = new VideoService(ctx);
      await expect(svc.addStandalone({
        url: "https://www.youtube.com/playlist?list=PL",
      })).rejects.toBeInstanceOf(UrlNotVideoError);
    } finally {
      ctx.sqlite.close();
    }
  });

  it("rejects duplicates", async () => {
    const ctx = setup();
    try {
      ctx.registry.register(new FakeAdapter({
        fetchVideo: {
          externalId: "vid1", title: "T", channelTitle: null, channelId: null,
          durationSeconds: null, thumbnailUrl: null, inferredStatus: "available",
          description: null, uploadDate: null, availabilityReason: null,
        },
      }));
      const svc = new VideoService(ctx);
      await svc.addStandalone({ url: "https://youtu.be/vid1" });
      await expect(svc.addStandalone({ url: "https://youtu.be/vid1" }))
        .rejects.toBeInstanceOf(VideoAlreadyTrackedError);
    } finally {
      ctx.sqlite.close();
    }
  });
});

describe("listStandalone", () => {
  it("returns videos with no active playlist_items", async () => {
    const ctx = await createTestBootContext();
    try {
      // Seed a standalone video (no playlist_items row)
      const standaloneId = ctx.videoRepo.upsert({
        provider: "youtube",
        externalId: "yt:standalone-1",
        title: "Standalone Video",
        channelTitle: null,
        durationSeconds: null,
        thumbnailUrl: null,
        availabilityStatus: "available",
      });

      // Seed a video that is in an active playlist_item
      const inPlaylistVideoId = ctx.videoRepo.upsert({
        provider: "youtube",
        externalId: "yt:in-playlist",
        title: "In-Playlist Video",
        channelTitle: null,
        durationSeconds: null,
        thumbnailUrl: null,
        availabilityStatus: "available",
      });
      const playlistId = ctx.playlistRepo.create({
        provider: "youtube",
        externalId: "pl:test",
        url: "https://youtube.com/playlist?list=pl:test",
        defaultFormat: "audio",
        title: "Test Playlist",
        channelTitle: null,
      });
      ctx.itemRepo.upsertActive(playlistId, inPlaylistVideoId, 0);

      const standalone = ctx.videoService.listStandalone();
      expect(standalone.map((v) => v.externalId)).toContain("yt:standalone-1");
      expect(standalone.map((v) => v.externalId)).not.toContain("yt:in-playlist");
      void standaloneId;
    } finally {
      ctx.cleanup();
    }
  });
});

describe("forceDownload", () => {
  it("rejects when video not available", async () => {
    const ctx = await createTestBootContext();
    try {
      const id = ctx.videoRepo.upsert({
        provider: "youtube",
        externalId: "yt:private-1",
        title: "Private Video",
        channelTitle: null,
        durationSeconds: null,
        thumbnailUrl: null,
        availabilityStatus: "private",
      });
      await expect(ctx.videoService.forceDownload(id, "audio")).rejects.toThrow(/not available/i);
    } finally {
      ctx.cleanup();
    }
  });

  it("throws VideoNotFoundError on missing id", async () => {
    const ctx = await createTestBootContext();
    try {
      await expect(ctx.videoService.forceDownload(99999, "audio")).rejects.toBeInstanceOf(VideoNotFoundError);
    } finally {
      ctx.cleanup();
    }
  });

  it("enqueues download_video job with priority 15", async () => {
    const ctx = await createTestBootContext();
    try {
      const id = ctx.videoRepo.upsert({
        provider: "youtube",
        externalId: "yt:available-1",
        title: "Available Video",
        channelTitle: null,
        durationSeconds: null,
        thumbnailUrl: null,
        availabilityStatus: "available",
      });
      const { jobId } = await ctx.videoService.forceDownload(id, "audio");
      const job = ctx.jobRepo.byId(jobId);
      expect(job?.priority).toBe(15);
      expect(job?.type).toBe("download_video");
    } finally {
      ctx.cleanup();
    }
  });

  // "unknown" = never checked. The download attempt is the check, so it must
  // not require a manual "Refresh availability" round-trip first.
  it("allows download when availability is unknown", async () => {
    const ctx = await createTestBootContext();
    try {
      const id = ctx.videoRepo.upsert({
        provider: "youtube",
        externalId: "yt:unknown-1",
        title: "Unknown Video",
        channelTitle: null,
        durationSeconds: null,
        thumbnailUrl: null,
        availabilityStatus: "unknown",
      });
      const { jobId } = await ctx.videoService.forceDownload(id, "video");
      expect(ctx.jobRepo.byId(jobId)?.type).toBe("download_video");
    } finally {
      ctx.cleanup();
    }
  });
});

describe("enqueueRefresh", () => {
  it("enqueues check_availability job", async () => {
    const ctx = await createTestBootContext();
    try {
      const id = ctx.videoRepo.upsert({
        provider: "youtube",
        externalId: "yt:any-1",
        title: "Any Video",
        channelTitle: null,
        durationSeconds: null,
        thumbnailUrl: null,
        availabilityStatus: "available",
      });
      const { jobId } = await ctx.videoService.enqueueRefresh(id);
      expect(ctx.jobRepo.byId(jobId)?.type).toBe("check_availability");
    } finally {
      ctx.cleanup();
    }
  });
});
