import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GET } from "./route";
import { createTestBootContext, type TestBootContext } from "@/lib/test-utils/boot-test-context";
import { __setBootContextForTesting } from "@/lib/test-utils/server-action-overrides";

describe("GET /api/jobs", () => {
  let ctx: TestBootContext;
  beforeEach(async () => { ctx = await createTestBootContext(); __setBootContextForTesting(ctx); });
  afterEach(() => { __setBootContextForTesting(null); ctx.cleanup(); });

  it("returns empty list", async () => {
    const res = await GET(new Request("http://x/api/jobs"));
    expect((await res.json()).jobs).toEqual([]);
  });

  it("filters by status", async () => {
    await ctx.queue.enqueue("check_availability", { videoId: 1 });
    const res = await GET(new Request("http://x/api/jobs?status=queued&limit=10"));
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.jobs[0].status).toBe("queued");
  });

  it("validates status param", async () => {
    const res = await GET(new Request("http://x/api/jobs?status=garbage"));
    expect(res.status).toBe(400);
  });
});
