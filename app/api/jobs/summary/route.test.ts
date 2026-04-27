import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GET } from "./route";
import { createTestBootContext, type TestBootContext } from "@/lib/test-utils/boot-test-context";
import { __setBootContextForTesting } from "@/lib/test-utils/server-action-overrides";

describe("GET /api/jobs/summary", () => {
  let ctx: TestBootContext;
  beforeEach(async () => { ctx = await createTestBootContext(); __setBootContextForTesting(ctx); });
  afterEach(() => { __setBootContextForTesting(null); ctx.cleanup(); });

  it("returns zeros on empty db", async () => {
    const res = await GET(new Request("http://x/api/jobs/summary"));
    expect(await res.json()).toEqual({ queued: 0, running: 0, failed: 0, completed24h: 0 });
  });

  it("counts queued jobs", async () => {
    await ctx.queue.enqueue("check_availability", { videoId: 1 });
    const res = await GET(new Request("http://x/api/jobs/summary"));
    expect(await res.json()).toMatchObject({ queued: 1 });
  });
});
