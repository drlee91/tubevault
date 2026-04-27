import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GET } from "./route";
import { createTestBootContext, type TestBootContext } from "@/lib/test-utils/boot-test-context";
import { __setBootContextForTesting } from "@/lib/test-utils/server-action-overrides";

describe("GET /api/storage/usage", () => {
  let ctx: TestBootContext;
  beforeEach(async () => {
    ctx = await createTestBootContext();
    __setBootContextForTesting(ctx);
  });
  afterEach(() => {
    __setBootContextForTesting(null);
    ctx.cleanup();
  });

  it("returns zeros on empty db", async () => {
    const res = await GET(new Request("http://x/api/storage/usage"));
    expect(await res.json()).toEqual({
      audio: { totalBytes: 0, fileCount: 0 },
      video: { totalBytes: 0, fileCount: 0 },
    });
  });

  it("aggregates by kind", async () => {
    // (video_id, kind) is UNIQUE, so two audio files need two distinct video rows
    const videoId1 = ctx.videoRepo.upsert({
      provider: "youtube",
      externalId: "test-vid-001",
      title: "Test Video 1",
      channelTitle: null,
      durationSeconds: null,
      thumbnailUrl: null,
      availabilityStatus: "available",
    });
    const videoId2 = ctx.videoRepo.upsert({
      provider: "youtube",
      externalId: "test-vid-002",
      title: "Test Video 2",
      channelTitle: null,
      durationSeconds: null,
      thumbnailUrl: null,
      availabilityStatus: "available",
    });

    // Two audio files (1 MB each) on different video rows
    ctx.mediaFileRepo.insert({
      videoId: videoId1,
      kind: "audio",
      filePath: "/tmp/a1.mp3",
      format: "mp3",
      quality: "192kbps",
      fileSizeBytes: 1024 * 1024,
      durationSeconds: 60,
    });
    ctx.mediaFileRepo.insert({
      videoId: videoId2,
      kind: "audio",
      filePath: "/tmp/a2.mp3",
      format: "mp3",
      quality: "192kbps",
      fileSizeBytes: 1024 * 1024,
      durationSeconds: 60,
    });

    // One video file (5 MB) on videoId1
    ctx.mediaFileRepo.insert({
      videoId: videoId1,
      kind: "video",
      filePath: "/tmp/v.mp4",
      format: "mp4",
      quality: "1080p",
      fileSizeBytes: 5 * 1024 * 1024,
      durationSeconds: 60,
    });

    const res = await GET(new Request("http://x/api/storage/usage"));
    const body = await res.json();
    expect(body.audio.fileCount).toBe(2);
    expect(body.audio.totalBytes).toBe(2 * 1024 * 1024);
    expect(body.video.fileCount).toBe(1);
    expect(body.video.totalBytes).toBe(5 * 1024 * 1024);
  });
});
