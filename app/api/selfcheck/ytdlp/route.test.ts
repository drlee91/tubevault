import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST } from "./route";
import { createTestBootContext, type TestBootContext } from "@/lib/test-utils/boot-test-context";
import { __setBootContextForTesting } from "@/lib/test-utils/server-action-overrides";
import { SelfCheckService } from "@/lib/services/self-check-service";

function makeCtxWithRunner(ctx: TestBootContext, runner: (file: string, args: string[]) => Promise<{ ok: boolean; output?: string }>) {
  const svc = new SelfCheckService({
    ytdlpPath: "yt-dlp",
    ffmpegPath: "ffmpeg",
    audioStoragePath: "/tmp",
    videoStoragePath: "/tmp",
    dbPath: ":memory:",
    runner,
  });
  return { ...ctx, selfCheckService: svc };
}

describe("POST /api/selfcheck/ytdlp", () => {
  let ctx: TestBootContext;

  beforeEach(async () => {
    ctx = await createTestBootContext();
  });

  afterEach(() => {
    __setBootContextForTesting(null);
    ctx.cleanup();
  });

  it("returns ok+version when yt-dlp is found", async () => {
    const patched = makeCtxWithRunner(ctx, async (file, args) => {
      if (file === "yt-dlp" && args[0] === "--version") return { ok: true, output: "2026.04.01" };
      return { ok: false, output: "not found" };
    });
    __setBootContextForTesting(patched as TestBootContext);

    const req = new Request("http://x/api/selfcheck/ytdlp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body).toEqual({ ok: true, version: "2026.04.01" });
  });

  it("returns ok+version when custom path is provided", async () => {
    const patched = makeCtxWithRunner(ctx, async (file, args) => {
      if (file === "/custom/yt-dlp" && args[0] === "--version") return { ok: true, output: "custom-2026" };
      return { ok: false, output: "not found" };
    });
    __setBootContextForTesting(patched as TestBootContext);

    const req = new Request("http://x/api/selfcheck/ytdlp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: "/custom/yt-dlp" }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body).toEqual({ ok: true, version: "custom-2026" });
  });

  it("returns ok:false when yt-dlp is not found", async () => {
    const patched = makeCtxWithRunner(ctx, async () => {
      return { ok: false, output: "command not found: yt-dlp" };
    });
    __setBootContextForTesting(patched as TestBootContext);

    const req = new Request("http://x/api/selfcheck/ytdlp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBeTruthy();
  });

  it("returns 400 on invalid body (empty string path)", async () => {
    __setBootContextForTesting(ctx);

    const req = new Request("http://x/api/selfcheck/ytdlp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: "" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
