import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { ensureBooted, resetBootForTests } from "@/lib/boot";
import { POST, GET } from "./route";

beforeEach(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "tubevault-api-"));
  process.env.TUBEVAULT_DB_PATH = path.join(dir, "db.sqlite");
  resetBootForTests();
});

afterEach(async () => {
  const ctx = await ensureBooted();
  await ctx.workerPool.stop();
  delete process.env.TUBEVAULT_DB_PATH;
});

describe("POST /api/playlists", () => {
  it("400 on invalid body", async () => {
    const res = await POST(new Request("http://x/api/playlists", { method: "POST", body: "{}" }));
    expect(res.status).toBe(400);
  });
  it("400 on unsupported provider", async () => {
    const res = await POST(new Request("http://x/api/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://soundcloud.com/x", defaultFormat: "audio" }),
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("PROVIDER_UNSUPPORTED");
  });
});

describe("GET /api/playlists", () => {
  it("returns empty list initially", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.playlists).toEqual([]);
  });
});
