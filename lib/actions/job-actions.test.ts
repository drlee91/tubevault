import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { retryJobAction } from "./job-actions";
import { createTestBootContext, type TestBootContext } from "@/lib/test-utils/boot-test-context";
import { __setBootContextForTesting } from "@/lib/test-utils/server-action-overrides";

describe("retryJobAction", () => {
  let ctx: TestBootContext;
  beforeEach(async () => { ctx = await createTestBootContext(); __setBootContextForTesting(ctx); });
  afterEach(() => { __setBootContextForTesting(null); ctx.cleanup(); });

  it("ok when failed job is retried", async () => {
    const id = await ctx.queue.enqueue("check_availability", { videoId: 1 });
    await ctx.queue.fail(id, "boom", false);
    const res = await retryJobAction(id);
    expect(res.ok).toBe(true);
    expect(ctx.queue.byId(id)?.status).toBe("queued");
  });

  it("NOT_RETRYABLE when job is queued", async () => {
    const id = await ctx.queue.enqueue("check_availability", { videoId: 1 });
    const res = await retryJobAction(id);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("NOT_RETRYABLE");
  });

  it("JOB_NOT_FOUND when missing id", async () => {
    const res = await retryJobAction(99999);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("JOB_NOT_FOUND");
  });
});
