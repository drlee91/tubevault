import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createTestBootContext, type TestBootContext } from "@/lib/test-utils/boot-test-context";
import { __setBootContextForTesting } from "@/lib/test-utils/server-action-overrides";
import { GET } from "./route";

let ctx: TestBootContext;
let tmp: string;
let mediaFileId: number;

async function seedMp3(bytes = 1024): Promise<void> {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "tubevault-stream-"));
  const filePath = path.join(tmp, "track.mp3");
  await fs.writeFile(filePath, Buffer.alloc(bytes, 0x7f));
  ctx = await createTestBootContext();
  __setBootContextForTesting(ctx);
  const videoId = ctx.videoRepo.upsert({
    provider: "youtube",
    externalId: "v1",
    title: "T",
    channelTitle: null,
    durationSeconds: 60,
    thumbnailUrl: null,
    availabilityStatus: "available",
  });
  mediaFileId = ctx.mediaFileRepo.insert({
    videoId,
    kind: "audio",
    filePath,
    format: "mp3",
    quality: "192kbps",
    fileSizeBytes: bytes,
    durationSeconds: 60,
  });
}

beforeEach(async () => { await seedMp3(); });
afterEach(async () => {
  __setBootContextForTesting(null);
  ctx.cleanup();
  await fs.rm(tmp, { recursive: true, force: true });
});

function req(headers: Record<string, string> = {}): Request {
  return new Request(`http://x/api/stream/${mediaFileId}`, { headers });
}

async function call(headers: Record<string, string> = {}) {
  return GET(req(headers), { params: Promise.resolve({ mediaFileId: String(mediaFileId) }) });
}

describe("GET /api/stream/:mediaFileId — happy path", () => {
  it("200 with full body when no Range header", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("Accept-Ranges")).toBe("bytes");
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(res.headers.get("Content-Length")).toBe("1024");
    expect(res.headers.get("Content-Range")).toBeNull();
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBe(1024);
  });

  it("206 with full range when Range: bytes=0-", async () => {
    const res = await call({ Range: "bytes=0-" });
    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe("bytes 0-1023/1024");
    expect(res.headers.get("Content-Length")).toBe("1024");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBe(1024);
  });

  it("sets Last-Modified from file mtime", async () => {
    const res = await call();
    const lm = res.headers.get("Last-Modified");
    expect(lm).toBeTruthy();
    expect(new Date(lm!).toString()).not.toBe("Invalid Date");
  });

  it("sets Cache-Control private + max-age=3600", async () => {
    const res = await call();
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=3600");
  });
});

describe("GET /api/stream/:mediaFileId — range edges", () => {
  it("206 partial for bytes=100-", async () => {
    const res = await call({ Range: "bytes=100-" });
    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe("bytes 100-1023/1024");
    expect(res.headers.get("Content-Length")).toBe("924");
  });

  it("206 partial for bytes=100-199 (closed range)", async () => {
    const res = await call({ Range: "bytes=100-199" });
    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe("bytes 100-199/1024");
    expect(res.headers.get("Content-Length")).toBe("100");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBe(100);
  });

  it("206 partial for bytes=0-1 (Safari probe)", async () => {
    const res = await call({ Range: "bytes=0-1" });
    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe("bytes 0-1/1024");
    expect(res.headers.get("Content-Length")).toBe("2");
  });

  it("416 when start >= size", async () => {
    const res = await call({ Range: "bytes=2000-" });
    expect(res.status).toBe(416);
    expect(res.headers.get("Content-Range")).toBe("bytes */1024");
  });

  it("416 on malformed Range header", async () => {
    const res = await call({ Range: "blocks=0-99" });
    expect(res.status).toBe(416);
  });

  it("416 on bytes=- (no numbers)", async () => {
    const res = await call({ Range: "bytes=-" });
    expect(res.status).toBe(416);
  });
});

describe("GET /api/stream/:mediaFileId — 404 + mime", () => {
  it("404 when mediaFileId unknown", async () => {
    const res = await GET(
      new Request(`http://x/api/stream/99999`),
      { params: Promise.resolve({ mediaFileId: "99999" }) },
    );
    expect(res.status).toBe(404);
  });

  it("404 when DB row exists but file missing on disk", async () => {
    await fs.unlink(ctx.mediaFileRepo.byId(mediaFileId)!.filePath);
    const res = await call();
    expect(res.status).toBe(404);
  });

  it("404 when mediaFileId is non-numeric", async () => {
    const res = await GET(
      new Request(`http://x/api/stream/abc`),
      { params: Promise.resolve({ mediaFileId: "abc" }) },
    );
    expect(res.status).toBe(404);
  });

  it("uses video/mp4 for an mp4 file", async () => {
    // re-seed with mp4
    const tmp2 = await fs.mkdtemp(path.join(os.tmpdir(), "tubevault-stream-mp4-"));
    const filePath = path.join(tmp2, "clip.mp4");
    await fs.writeFile(filePath, Buffer.alloc(64, 0));
    const newId = ctx.mediaFileRepo.insert({
      videoId: ctx.mediaFileRepo.byId(mediaFileId)!.videoId,
      kind: "video",
      filePath,
      format: "mp4",
      quality: "1080p",
      fileSizeBytes: 64,
      durationSeconds: 60,
    });
    const res = await GET(
      new Request(`http://x/api/stream/${newId}`),
      { params: Promise.resolve({ mediaFileId: String(newId) }) },
    );
    expect(res.headers.get("Content-Type")).toBe("video/mp4");
    await fs.rm(tmp2, { recursive: true, force: true });
  });
});
