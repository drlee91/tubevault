import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { addPlaylistAction, syncPlaylistAction, deletePlaylistAction } from "./playlist-actions";
import { createTestBootContext, type TestBootContext } from "@/lib/test-utils/boot-test-context";
import { __setBootContextForTesting } from "@/lib/test-utils/server-action-overrides";

describe("addPlaylistAction", () => {
  let ctx: TestBootContext;
  beforeEach(async () => { ctx = await createTestBootContext(); __setBootContextForTesting(ctx); });
  afterEach(() => { __setBootContextForTesting(null); ctx.cleanup(); });

  it("returns ok with playlistId on success", async () => {
    const res = await addPlaylistAction({
      url: "https://www.youtube.com/playlist?list=PLtest",
      defaultFormat: "audio",
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.playlistId).toBeGreaterThan(0);
  });

  it("returns error PLAYLIST_ALREADY_TRACKED on duplicate", async () => {
    const url = "https://www.youtube.com/playlist?list=PLtest";
    await addPlaylistAction({ url, defaultFormat: "audio" });
    const dup = await addPlaylistAction({ url, defaultFormat: "audio" });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error.code).toBe("PLAYLIST_ALREADY_TRACKED");
  });

  it("returns error URL_NOT_PLAYLIST on video URL", async () => {
    const res = await addPlaylistAction({ url: "https://youtu.be/abc123", defaultFormat: "audio" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("URL_NOT_PLAYLIST");
  });
});

describe("syncPlaylistAction", () => {
  it("ok when playlist exists", async () => {
    const ctx = await createTestBootContext();
    __setBootContextForTesting(ctx);
    try {
      const create = await addPlaylistAction({
        url: "https://www.youtube.com/playlist?list=PLtest",
        defaultFormat: "audio",
      });
      if (!create.ok) throw new Error("setup failed");
      const res = await syncPlaylistAction(create.data.playlistId);
      expect(res.ok).toBe(true);
    } finally { __setBootContextForTesting(null); ctx.cleanup(); }
  });
});

describe("deletePlaylistAction", () => {
  it("ok when playlist exists", async () => {
    const ctx = await createTestBootContext();
    __setBootContextForTesting(ctx);
    try {
      const create = await addPlaylistAction({
        url: "https://www.youtube.com/playlist?list=PLtest",
        defaultFormat: "audio",
      });
      if (!create.ok) throw new Error("setup failed");
      const res = await deletePlaylistAction(create.data.playlistId);
      expect(res.ok).toBe(true);
    } finally { __setBootContextForTesting(null); ctx.cleanup(); }
  });
});
