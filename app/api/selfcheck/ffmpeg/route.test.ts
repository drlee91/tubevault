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

describe("POST /api/selfcheck/ffmpeg", () => {
  let ctx: TestBootContext;

  beforeEach(async () => {
    ctx = await createTestBootContext();
  });

  afterEach(() => {
    __setBootContextForTesting(null);
    ctx.cleanup();
  });

  it("returns ok+version when ffmpeg is found", async () => {
    const patched = makeCtxWithRunner(ctx, async (file, args) => {
      if (file === "ffmpeg" && args[0] === "-version") return { ok: true, output: "ffmpeg version 7.0" };
      return { ok: false, output: "not found" };
    });
    __setBootContextForTesting(patched as TestBootContext);

    const req = new Request("http://x/api/selfcheck/ffmpeg", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body).toEqual({ ok: true, version: "ffmpeg version 7.0" });
  });

  it("returns ok+version when custom path is provided", async () => {
    const patched = makeCtxWithRunner(ctx, async (file, args) => {
      if (file === "/usr/local/bin/ffmpeg" && args[0] === "-version") return { ok: true, output: "ffmpeg version 6.1" };
      return { ok: false, output: "not found" };
    });
    __setBootContextForTesting(patched as TestBootContext);

    const req = new Request("http://x/api/selfcheck/ffmpeg", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: "/usr/local/bin/ffmpeg" }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body).toEqual({ ok: true, version: "ffmpeg version 6.1" });
  });

  it("returns ok:false when ffmpeg is not found", async () => {
    const patched = makeCtxWithRunner(ctx, async () => {
      return { ok: false, output: "command not found: ffmpeg" };
    });
    __setBootContextForTesting(patched as TestBootContext);

    const req = new Request("http://x/api/selfcheck/ffmpeg", {
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

    const req = new Request("http://x/api/selfcheck/ffmpeg", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: "" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
