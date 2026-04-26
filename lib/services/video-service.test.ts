import { describe, it, expect } from "vitest";
import { createTestDb } from "@/lib/db/__tests__/test-db";
import { VideoRepo } from "@/lib/db/repositories/video-repo";
import { JobRepo } from "@/lib/db/repositories/job-repo";
import { JobQueue } from "@/lib/jobs/queue";
import { ProviderRegistry } from "@/lib/providers/registry";
import { FakeAdapter } from "@/lib/providers/__tests__/fake-adapter";
import { VideoService, VideoAlreadyTrackedError, UrlNotVideoError } from "./video-service";

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
      const { video, downloadJobId } = await svc.addStandalone({
        url: "https://youtu.be/vid1",
        format: "audio",
      });
      expect(video.externalId).toBe("vid1");
      expect(ctx.jobRepo.byId(downloadJobId)?.type).toBe("download_video");
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
        format: "audio",
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
      await svc.addStandalone({ url: "https://youtu.be/vid1", format: "audio" });
      await expect(svc.addStandalone({ url: "https://youtu.be/vid1", format: "audio" }))
        .rejects.toBeInstanceOf(VideoAlreadyTrackedError);
    } finally {
      ctx.sqlite.close();
    }
  });
});
