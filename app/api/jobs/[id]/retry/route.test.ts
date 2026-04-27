import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import { createTestBootContext, type TestBootContext } from "@/lib/test-utils/boot-test-context";
import { __setBootContextForTesting } from "@/lib/test-utils/server-action-overrides";

describe("POST /api/jobs/[id]/retry", () => {
  let ctx: TestBootContext;
  beforeEach(async () => { ctx = await createTestBootContext(); __setBootContextForTesting(ctx); });
  afterEach(() => { __setBootContextForTesting(null); ctx.cleanup(); });

  it("404 when job missing", async () => {
    const res = await POST(new Request("http://x/api/jobs/999/retry", { method: "POST" }), { params: Promise.resolve({ id: "999" }) });
    expect(res.status).toBe(404);
  });

  it("409 when job not failed", async () => {
    const id = await ctx.queue.enqueue("check_availability", { videoId: 1 });
    const res = await POST(new Request("http://x", { method: "POST" }), { params: Promise.resolve({ id: String(id) }) });
    expect(res.status).toBe(409);
  });

  it("200 + resets job when failed", async () => {
    const id = await ctx.queue.enqueue("check_availability", { videoId: 1 });
    await ctx.queue.fail(id, "boom", false);
    const res = await POST(new Request("http://x", { method: "POST" }), { params: Promise.resolve({ id: String(id) }) });
    expect(res.status).toBe(200);
    expect(ctx.queue.byId(id)?.status).toBe("queued");
  });
});
