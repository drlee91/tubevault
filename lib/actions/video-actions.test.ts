import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { addVideoAction, downloadVideoAction, refreshVideoAction } from "./video-actions";
import { createTestBootContext, type TestBootContext } from "@/lib/test-utils/boot-test-context";
import { __setBootContextForTesting } from "@/lib/test-utils/server-action-overrides";

describe("addVideoAction", () => {
  let ctx: TestBootContext;
  beforeEach(async () => { ctx = await createTestBootContext(); __setBootContextForTesting(ctx); });
  afterEach(() => { __setBootContextForTesting(null); ctx.cleanup(); });

  it("returns ok with videoId and downloadJobId on success", async () => {
    const res = await addVideoAction({
      url: "https://www.youtube.com/watch?v=abc123",
      format: "audio",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.videoId).toBeGreaterThan(0);
      expect(res.data.downloadJobId).toBeGreaterThan(0);
    }
  });

  it("returns error URL_NOT_VIDEO on playlist URL", async () => {
    const res = await addVideoAction({
      url: "https://www.youtube.com/playlist?list=PLtest",
      format: "audio",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("URL_NOT_VIDEO");
  });
});

describe("downloadVideoAction", () => {
  let ctx: TestBootContext;
  beforeEach(async () => { ctx = await createTestBootContext(); __setBootContextForTesting(ctx); });
  afterEach(() => { __setBootContextForTesting(null); ctx.cleanup(); });

  it("returns ok with jobId on success", async () => {
    const videoId = ctx.videoRepo.upsert({
      provider: "youtube",
      externalId: "dl_happy",
      title: "Happy Download Video",
      channelTitle: "Test Channel",
      channelId: null,
      durationSeconds: 120,
      thumbnailUrl: null,
      availabilityStatus: "available",
      availabilityReason: null,
    });
    const res = await downloadVideoAction(videoId, "audio");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.jobId).toBeGreaterThan(0);
  });

  it("returns error VIDEO_NOT_AVAILABLE on private video", async () => {
    const videoId = ctx.videoRepo.upsert({
      provider: "youtube",
      externalId: "private_vid",
      title: "Private Video",
      channelTitle: "Test Channel",
      channelId: null,
      durationSeconds: 120,
      thumbnailUrl: null,
      availabilityStatus: "private",
      availabilityReason: null,
    });
    const res = await downloadVideoAction(videoId, "audio");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("VIDEO_NOT_AVAILABLE");
  });
});

describe("refreshVideoAction", () => {
  let ctx: TestBootContext;
  beforeEach(async () => { ctx = await createTestBootContext(); __setBootContextForTesting(ctx); });
  afterEach(() => { __setBootContextForTesting(null); ctx.cleanup(); });

  it("returns ok with jobId on success", async () => {
    const videoId = ctx.videoRepo.upsert({
      provider: "youtube",
      externalId: "refresh_happy",
      title: "Refresh Video",
      channelTitle: "Test Channel",
      channelId: null,
      durationSeconds: 60,
      thumbnailUrl: null,
      availabilityStatus: "available",
      availabilityReason: null,
    });
    const res = await refreshVideoAction(videoId);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.jobId).toBeGreaterThan(0);
  });

  it("returns error VIDEO_NOT_FOUND for missing id", async () => {
    const res = await refreshVideoAction(9999);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("VIDEO_NOT_FOUND");
  });
});
