import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import { createTestBootContext, type TestBootContext } from "@/lib/test-utils/boot-test-context";
import { __setBootContextForTesting } from "@/lib/test-utils/server-action-overrides";

describe("POST /api/videos/[id]/refresh", () => {
  let ctx: TestBootContext;
  beforeEach(async () => { ctx = await createTestBootContext(); __setBootContextForTesting(ctx); });
  afterEach(() => { __setBootContextForTesting(null); ctx.cleanup(); });

  it("404 when video not found", async () => {
    const res = await POST(new Request("http://x", { method: "POST" }), { params: Promise.resolve({ id: "9999" }) });
    expect(res.status).toBe(404);
  });

  it("202 + jobId on success", async () => {
    const id = ctx.videoRepo.upsert({
      provider: "youtube",
      externalId: "yt:refresh-video",
      title: "Refresh Test Video",
      channelTitle: "Test Channel",
      durationSeconds: 120,
      thumbnailUrl: null,
      availabilityStatus: "available",
    });
    const res = await POST(new Request("http://x", { method: "POST" }), { params: Promise.resolve({ id: String(id) }) });
    expect(res.status).toBe(202);
    expect((await res.json()).jobId).toEqual(expect.any(Number));
  });
});
