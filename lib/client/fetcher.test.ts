import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetcher } from "./fetcher";

describe("fetcher", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns JSON on 2xx", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } }),
    );
    const out = await fetcher<{ ok: boolean }>("http://x");
    expect(out).toEqual({ ok: true });
  });

  it("throws with status on non-2xx", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "BAD" } }), { status: 400, headers: { "content-type": "application/json" } }),
    );
    await expect(fetcher("http://x")).rejects.toMatchObject({ status: 400 });
  });
});
