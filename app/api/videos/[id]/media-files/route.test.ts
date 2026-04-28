import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createTestBootContext, type TestBootContext } from "@/lib/test-utils/boot-test-context";
import { __setBootContextForTesting } from "@/lib/test-utils/server-action-overrides";
import { GET } from "./route";

let ctx: TestBootContext; let tmp: string; let videoId: number; let mediaFileId: number;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "tubevault-mf-"));
  ctx = await createTestBootContext();
  __setBootContextForTesting(ctx);
  videoId = ctx.videoRepo.upsert({
    provider: "youtube", externalId: "v1", title: "T", channelTitle: null,
    durationSeconds: 60, thumbnailUrl: null, availabilityStatus: "available",
  });
  mediaFileId = ctx.mediaFileRepo.insert({
    videoId, kind: "audio", filePath: path.join(tmp, "a.mp3"),
    format: "mp3", quality: "192", fileSizeBytes: 1, durationSeconds: 60,
  });
});
afterEach(async () => { __setBootContextForTesting(null); ctx.cleanup(); await fs.rm(tmp, { recursive: true, force: true }); });

async function call(id: number) {
  return GET(new Request(`http://x/api/videos/${id}/media-files`),
    { params: Promise.resolve({ id: String(id) }) });
}

describe("GET /api/videos/[id]/media-files", () => {
  it("returns audio + video map", async () => {
    const res = await call(videoId);
    const body = await res.json();
    expect(body.audio).toBe(mediaFileId);
    expect(body.video).toBeNull();
  });

  it("404 when video unknown", async () => {
    const res = await call(99999);
    expect(res.status).toBe(404);
  });
});
