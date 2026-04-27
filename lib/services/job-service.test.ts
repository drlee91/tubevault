import { describe, it, expect } from "vitest";
import { createTestDb } from "@/lib/db/__tests__/test-db";
import { JobRepo } from "@/lib/db/repositories/job-repo";
import { JobQueue } from "@/lib/jobs/queue";
import { VideoRepo } from "@/lib/db/repositories/video-repo";
import { JobService } from "./job-service";

function setup() {
  const { db, sqlite } = createTestDb();
  const jobRepo = new JobRepo(db);
  const queue = new JobQueue(db, jobRepo);
  const videoRepo = new VideoRepo(db);
  return { sqlite, jobRepo, queue, videoRepo };
}

describe("JobService.summary", () => {
  it("returns counts grouped by status", async () => {
    const ctx = setup();
    try {
      const svc = new JobService({ jobRepo: ctx.jobRepo, queue: ctx.queue });
      await ctx.queue.enqueue("check_availability", { videoId: 1 });
      const s = svc.summary();
      expect(s.queued).toBe(1);
      expect(s.running).toBe(0);
      expect(s.failed).toBe(0);
    } finally {
      ctx.sqlite.close();
    }
  });
});

describe("JobService.list", () => {
  it("filters by status", async () => {
    const ctx = setup();
    try {
      const svc = new JobService({ jobRepo: ctx.jobRepo, queue: ctx.queue });
      await ctx.queue.enqueue("check_availability", { videoId: 1 });
      const out = svc.list({ status: "queued", limit: 10 });
      expect(out.total).toBe(1);
      expect(out.jobs[0]!.status).toBe("queued");
    } finally {
      ctx.sqlite.close();
    }
  });

  it("resolves subject for download_video job", async () => {
    const ctx = setup();
    try {
      // Seed a video so subject can be resolved.
      const videoId = ctx.videoRepo.upsert({
        provider: "youtube",
        externalId: "ext-test-1",
        title: "Test Video Title",
        channelTitle: "Test Channel",
        channelId: null,
        durationSeconds: 120,
        thumbnailUrl: null,
        availabilityStatus: "available",
      });
      await ctx.queue.enqueue("download_video", { videoId, kind: "audio" });
      const svc = new JobService({ jobRepo: ctx.jobRepo, queue: ctx.queue });
      const out = svc.list({ limit: 10 });
      expect(out.jobs[0]!.subject?.kind).toBe("video");
      expect(out.jobs[0]!.subject?.title).toBeTruthy();
    } finally {
      ctx.sqlite.close();
    }
  });
});

describe("JobService.retry", () => {
  it("resets a failed job to queued", async () => {
    const ctx = setup();
    try {
      const svc = new JobService({ jobRepo: ctx.jobRepo, queue: ctx.queue });
      const id = await ctx.queue.enqueue("check_availability", { videoId: 1 });
      await ctx.queue.fail(id, "boom", false);
      const result = await svc.retry(id);
      expect(result.retried).toBe(true);
      const job = ctx.queue.byId(id);
      expect(job?.status).toBe("queued");
      expect(job?.attempts).toBe(0);
      expect(job?.lastError).toBeNull();
    } finally {
      ctx.sqlite.close();
    }
  });

  it("throws JobNotFoundError on missing id", async () => {
    const ctx = setup();
    try {
      const svc = new JobService({ jobRepo: ctx.jobRepo, queue: ctx.queue });
      await expect(svc.retry(99999)).rejects.toThrow(/not found/i);
    } finally {
      ctx.sqlite.close();
    }
  });

  it("throws NotRetryableError when job is not failed", async () => {
    const ctx = setup();
    try {
      const svc = new JobService({ jobRepo: ctx.jobRepo, queue: ctx.queue });
      const id = await ctx.queue.enqueue("check_availability", { videoId: 1 });
      // status is "queued" — should not be retryable
      await expect(svc.retry(id)).rejects.toThrow(/not retryable/i);
    } finally {
      ctx.sqlite.close();
    }
  });
});
