import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { resetBootForTests, ensureBooted } from "./boot";

describe("ensureBooted", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "tubevault-boot-"));
    process.env.TUBEVAULT_DB_PATH = path.join(dir, "db.sqlite");
    resetBootForTests();
  });
  afterEach(async () => {
    const ctx = await ensureBooted();
    await ctx.workerPool.stop();
    delete process.env.TUBEVAULT_DB_PATH;
  });

  it("returns the same context across calls (idempotent)", async () => {
    const a = await ensureBooted();
    const b = await ensureBooted();
    expect(a).toBe(b);
  });

  it("constructs a working pipeline (registry has YouTubeAdapter, services defined)", async () => {
    const ctx = await ensureBooted();
    expect(ctx.registry.findById("youtube")).not.toBeNull();
    expect(ctx.syncService).toBeDefined();
    expect(ctx.downloadService).toBeDefined();
    expect(ctx.playlistService).toBeDefined();
    expect(ctx.videoService).toBeDefined();
  });
});
