import { describe, it, expect, vi } from "vitest";
import { SyncPlaylistHandler } from "./sync-playlist";
import { DownloadVideoHandler } from "./download-video";
import { CheckAvailabilityHandler } from "./check-availability";
import { PlaylistAlreadySyncingError } from "@/lib/services/sync-service";
import { VideoBecameUnavailableError } from "@/lib/services/download-service";
import type { JobRow } from "../types";

function fakeJob<T>(payload: T, type: string): JobRow {
  return {
    id: 1, type, payload, status: "running", priority: 0, attempts: 1,
    maxAttempts: 3, lastError: null, createdAt: new Date(),
    startedAt: new Date(), finishedAt: null, nextAttemptAt: null,
  } as unknown as JobRow;
}

describe("SyncPlaylistHandler", () => {
  it("returns success on completed sync", async () => {
    const sync = {
      sync: vi.fn(async () => ({
        syncRunId: 1,
        status: "success" as const,
        stats: { added: 0, removed: 0, unchanged: 0, unavailable: 0 },
      })),
    };
    const h = new SyncPlaylistHandler(sync as unknown as ConstructorParameters<typeof SyncPlaylistHandler>[0]);
    const r = await h.handle(fakeJob({ playlistId: 1 }, "sync_playlist"));
    expect(r.success).toBe(true);
  });

  it("returns transient failure when lock conflict", async () => {
    const sync = {
      sync: vi.fn(async () => { throw new PlaylistAlreadySyncingError(1); }),
    };
    const h = new SyncPlaylistHandler(sync as unknown as ConstructorParameters<typeof SyncPlaylistHandler>[0]);
    const r = await h.handle(fakeJob({ playlistId: 1 }, "sync_playlist"));
    expect(r.success).toBe(false);
    expect(r.transient).toBe(true);
  });
});

describe("DownloadVideoHandler", () => {
  it("returns success on completed download", async () => {
    const dl = { download: vi.fn(async () => ({ id: 1 })) };
    const videoRepo = { setAvailability: vi.fn() };
    const h = new DownloadVideoHandler(
      dl as unknown as ConstructorParameters<typeof DownloadVideoHandler>[0],
      videoRepo as unknown as ConstructorParameters<typeof DownloadVideoHandler>[1],
    );
    const r = await h.handle(fakeJob({ videoId: 1, kind: "audio" }, "download_video"));
    expect(r.success).toBe(true);
  });

  it("on VideoBecameUnavailableError, sets availability + returns non-transient failure", async () => {
    const dl = {
      download: vi.fn(async () => { throw new VideoBecameUnavailableError(1, "removed"); }),
    };
    const videoRepo = { setAvailability: vi.fn() };
    const h = new DownloadVideoHandler(
      dl as unknown as ConstructorParameters<typeof DownloadVideoHandler>[0],
      videoRepo as unknown as ConstructorParameters<typeof DownloadVideoHandler>[1],
    );
    const r = await h.handle(fakeJob({ videoId: 1, kind: "audio" }, "download_video"));
    expect(r.success).toBe(false);
    expect(r.transient).toBe(false);
    expect(videoRepo.setAvailability).toHaveBeenCalledWith(1, "removed", "removed");
  });
});

describe("CheckAvailabilityHandler", () => {
  it("updates videos.availability_status from probe", async () => {
    const adapter = {
      provider: "youtube" as const,
      checkAvailability: vi.fn(async () => ({ status: "removed" as const, reason: "x" })),
    };
    const registry = { findById: vi.fn(() => adapter) };
    const videoRepo = {
      byId: vi.fn(() => ({ id: 1, provider: "youtube", externalId: "v" })),
      setAvailability: vi.fn(),
    };
    const h = new CheckAvailabilityHandler(
      registry as unknown as ConstructorParameters<typeof CheckAvailabilityHandler>[0],
      videoRepo as unknown as ConstructorParameters<typeof CheckAvailabilityHandler>[1],
    );
    const r = await h.handle(fakeJob({ videoId: 1 }, "check_availability"));
    expect(r.success).toBe(true);
    expect(videoRepo.setAvailability).toHaveBeenCalledWith(1, "removed", "x");
  });
});
