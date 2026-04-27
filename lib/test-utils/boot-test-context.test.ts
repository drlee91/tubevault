import { describe, it, expect } from "vitest";
import { createTestBootContext } from "./boot-test-context";

describe("createTestBootContext", () => {
  it("returns a BootContext with all services wired", async () => {
    const ctx = await createTestBootContext();
    expect(ctx.playlistService).toBeDefined();
    expect(ctx.videoService).toBeDefined();
    expect(ctx.syncService).toBeDefined();
    expect(ctx.downloadService).toBeDefined();
    expect(ctx.settingsService).toBeDefined();
    expect(ctx.queue).toBeDefined();
    expect(ctx.registry).toBeDefined();
    ctx.cleanup();
  });

  it("uses :memory: db", async () => {
    const ctx = await createTestBootContext();
    const playlists = ctx.playlistService.list();
    expect(playlists).toEqual([]);
    ctx.cleanup();
  });
});
