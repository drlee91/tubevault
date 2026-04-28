// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMediaFileResolver } from "./resolve-media-file";

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ audio: 11, video: 22 }), { status: 200 }),
  );
});

describe("createMediaFileResolver", () => {
  it("returns mediaFileId for cached entry without re-fetching", async () => {
    const resolver = createMediaFileResolver();
    const id1 = await resolver.fetchAndCache(1);
    expect(id1.audio).toBe(11);
    expect(resolver.get(1, "audio")).toBe(11);
    expect(resolver.get(1, "video")).toBe(22);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    await resolver.fetchAndCache(1);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("returns null when video missing", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(new Response("not found", { status: 404 }));
    const resolver = createMediaFileResolver();
    const r = await resolver.fetchAndCache(99);
    expect(r.audio).toBeNull();
    expect(r.video).toBeNull();
  });
});
