import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ensureBooted, resetBootForTests } from "@/lib/boot";
import { GET, DELETE } from "./route";

beforeEach(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "tubevault-detail-"));
  process.env.TUBEVAULT_DB_PATH = path.join(dir, "db.sqlite");
  resetBootForTests();
});

afterEach(async () => {
  const ctx = await ensureBooted();
  await ctx.workerPool.stop();
  delete process.env.TUBEVAULT_DB_PATH;
});

describe("GET /api/playlists/[id]", () => {
  it("404 when not found", async () => {
    const res = await GET(new Request("http://x"), { params: Promise.resolve({ id: "999" }) });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/playlists/[id]", () => {
  it("returns 204 and removes the playlist", async () => {
    const ctx = await ensureBooted();
    const { playlist } = await ctx.playlistService.create({
      url: "https://www.youtube.com/playlist?list=PLD",
      defaultFormat: "audio",
    });
    const res = await DELETE(new Request("http://x"), {
      params: Promise.resolve({ id: String(playlist.id) }),
    });
    expect(res.status).toBe(204);
  });
});
