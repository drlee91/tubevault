import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ensureBooted, resetBootForTests } from "@/lib/boot";

beforeEach(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "tubevault-e2e-"));
  process.env.TUBEVAULT_DB_PATH = path.join(dir, "db.sqlite");
  resetBootForTests();
});

afterEach(async () => {
  const ctx = await ensureBooted();
  await ctx.workerPool.stop();
  delete process.env.TUBEVAULT_DB_PATH;
});

describe("end-to-end pipeline smoke", () => {
  it("ensureBooted wires repos + services + queue + worker", async () => {
    const ctx = await ensureBooted();
    expect(ctx.registry.findById("youtube")).not.toBeNull();
    expect(ctx.playlistService).toBeDefined();
    expect(ctx.videoService).toBeDefined();
    expect(ctx.syncService).toBeDefined();
    expect(ctx.downloadService).toBeDefined();
    expect(ctx.queue).toBeDefined();
    expect(ctx.workerPool).toBeDefined();
  });

  it("create playlist → enqueues sync_playlist → returns syncJobId", async () => {
    const ctx = await ensureBooted();
    const { playlist, syncJobId } = await ctx.playlistService.create({
      url: "https://www.youtube.com/playlist?list=PLE2E",
      defaultFormat: "audio",
    });
    expect(playlist.id).toBeGreaterThan(0);
    expect(playlist.externalId).toBe("PLE2E");
    expect(syncJobId).toBeGreaterThan(0);
    // Stop the pool BEFORE the worker tries to run the job (which would call yt-dlp for real).
    // afterEach handles workerPool.stop() but we want to ensure the job doesn't actually fire here.
  }, 10_000);
});
