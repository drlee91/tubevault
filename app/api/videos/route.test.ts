import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ensureBooted, resetBootForTests } from "@/lib/boot";
import { GET, POST } from "./route";
import { createTestBootContext, type TestBootContext } from "@/lib/test-utils/boot-test-context";
import { __setBootContextForTesting } from "@/lib/test-utils/server-action-overrides";

beforeEach(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "tubevault-vid-"));
  process.env.TUBEVAULT_DB_PATH = path.join(dir, "db.sqlite");
  resetBootForTests();
});

afterEach(async () => {
  const ctx = await ensureBooted();
  await ctx.workerPool.stop();
  delete process.env.TUBEVAULT_DB_PATH;
});

describe("POST /api/videos", () => {
  it("400 on invalid body", async () => {
    const res = await POST(new Request("http://x", { method: "POST", body: "{}" }));
    expect(res.status).toBe(400);
  });
  it("400 on playlist URL", async () => {
    const res = await POST(new Request("http://x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://www.youtube.com/playlist?list=PL" }),
    }));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/videos (standalone)", () => {
  let ctx: TestBootContext;
  beforeEach(async () => { ctx = await createTestBootContext(); __setBootContextForTesting(ctx); });
  afterEach(() => { __setBootContextForTesting(null); ctx.cleanup(); });

  it("returns empty list", async () => {
    const res = await GET(new Request("http://x/api/videos"));
    expect((await res.json()).videos).toEqual([]);
  });

  it("returns standalone videos only", async () => {
    const standaloneId = ctx.videoRepo.upsert({
      provider: "youtube",
      externalId: "yt:standalone-1",
      title: "Standalone Video",
      channelTitle: "Test Channel",
      durationSeconds: 120,
      thumbnailUrl: null,
      availabilityStatus: "available",
    });

    const playlistId = ctx.playlistRepo.create({
      provider: "youtube",
      externalId: "PL-test-1",
      url: "https://www.youtube.com/playlist?list=PL-test-1",
      defaultFormat: "audio",
      title: "Test Playlist",
    });
    const inPlaylistVideoId = ctx.videoRepo.upsert({
      provider: "youtube",
      externalId: "yt:in-playlist",
      title: "In Playlist Video",
      channelTitle: "Test Channel",
      durationSeconds: 60,
      thumbnailUrl: null,
      availabilityStatus: "available",
    });
    ctx.itemRepo.upsertActive(playlistId, inPlaylistVideoId, 0);

    const res = await GET(new Request("http://x/api/videos"));
    const body = await res.json();
    expect(body.videos.map((v: { externalId: string }) => v.externalId)).toContain("yt:standalone-1");
    expect(body.videos.map((v: { externalId: string }) => v.externalId)).not.toContain("yt:in-playlist");
  });
});
