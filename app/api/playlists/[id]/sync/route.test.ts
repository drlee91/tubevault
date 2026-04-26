import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ensureBooted, resetBootForTests } from "@/lib/boot";
import { POST } from "./route";

beforeEach(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "tubevault-sync-"));
  process.env.TUBEVAULT_DB_PATH = path.join(dir, "db.sqlite");
  resetBootForTests();
});

afterEach(async () => {
  const ctx = await ensureBooted();
  await ctx.workerPool.stop();
  delete process.env.TUBEVAULT_DB_PATH;
});

describe("POST /api/playlists/[id]/sync", () => {
  it("404 when missing", async () => {
    const res = await POST(new Request("http://x"), { params: Promise.resolve({ id: "999" }) });
    expect(res.status).toBe(404);
  });
  it("202 + syncJobId when present", async () => {
    const ctx = await ensureBooted();
    const { playlist } = await ctx.playlistService.create({
      url: "https://www.youtube.com/playlist?list=PLZ",
      defaultFormat: "audio",
    });
    const res = await POST(new Request("http://x"), {
      params: Promise.resolve({ id: String(playlist.id) }),
    });
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.syncJobId).toBeTypeOf("number");
  });
});
