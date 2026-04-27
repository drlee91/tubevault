import { describe, it, expect } from "vitest";
import { createTestBootContext } from "@/lib/test-utils/boot-test-context";
import { __setBootContextForTesting } from "@/lib/test-utils/server-action-overrides";
import { GET, DELETE } from "./route";

describe("GET /api/playlists/[id]", () => {
  it("returns full shape (F1)", async () => {
    const ctx = await createTestBootContext();
    __setBootContextForTesting(ctx);
    try {
      // Seed playlist
      const playlistId = ctx.playlistRepo.create({
        provider: "youtube",
        externalId: "PLtest1",
        url: "https://www.youtube.com/playlist?list=PLtest1",
        defaultFormat: "audio",
        title: "Test Playlist",
      });

      // Seed video
      const videoId = ctx.videoRepo.upsert({
        provider: "youtube",
        externalId: "vid001",
        title: "Test Video Title",
        channelTitle: "Test Channel",
        durationSeconds: 180,
        thumbnailUrl: null,
        availabilityStatus: "available",
      });

      // Seed playlist item
      ctx.itemRepo.upsertActive(playlistId, videoId, 0);

      // Seed a queued download_video job for the video
      await ctx.queue.enqueue("download_video", { videoId, kind: "audio" });

      // Seed a sync run
      const syncRunId = ctx.syncRunRepo.startRun({ playlistId, triggeredBy: "manual" });
      ctx.syncRunRepo.finishRun(syncRunId, {
        status: "success",
        stats: { added: 1, removed: 0, unchanged: 0, unavailable: 0, downloaded: 0 },
        errorLog: [],
      });

      const res = await GET(new Request("http://x"), { params: Promise.resolve({ id: String(playlistId) }) });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.playlist.stats.totalItems).toBe(1);
      expect(body.items[0].video.title).toBeDefined();
      expect(body.items[0].pendingJob?.type).toBe("download_video");
      expect(body.recentSyncRuns).toBeInstanceOf(Array);
    } finally {
      __setBootContextForTesting(null);
      ctx.cleanup();
    }
  });

  it("returns 404 when playlist missing", async () => {
    const ctx = await createTestBootContext();
    __setBootContextForTesting(ctx);
    try {
      const res = await GET(new Request("http://x"), { params: Promise.resolve({ id: "999" }) });
      expect(res.status).toBe(404);
    } finally {
      __setBootContextForTesting(null);
      ctx.cleanup();
    }
  });
});

describe("DELETE /api/playlists/[id]", () => {
  it("returns 204 and removes the playlist", async () => {
    const ctx = await createTestBootContext();
    __setBootContextForTesting(ctx);
    try {
      const { playlist } = await ctx.playlistService.create({
        url: "https://www.youtube.com/playlist?list=PLD",
        defaultFormat: "audio",
      });
      const res = await DELETE(new Request("http://x"), {
        params: Promise.resolve({ id: String(playlist.id) }),
      });
      expect(res.status).toBe(204);
    } finally {
      __setBootContextForTesting(null);
      ctx.cleanup();
    }
  });
});
