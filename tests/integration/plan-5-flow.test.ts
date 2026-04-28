import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestBootContext, type TestBootContext } from "@/lib/test-utils/boot-test-context";
import { __setBootContextForTesting } from "@/lib/test-utils/server-action-overrides";
import { addPlaylistAction } from "@/lib/actions/playlist-actions";
import { drainQueue } from "@/tests/helpers/drain";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("Plan 5 end-to-end flow", () => {
  let ctx: TestBootContext;
  let tmp: string;

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), "tubevault-plan5-"));
    ctx = await createTestBootContext({ withHandlers: true });
    ctx.settingsService.setAudioStoragePath(tmp);
    ctx.settingsService.setUseSingleStoragePath(true);
    __setBootContextForTesting(ctx);
  });

  afterEach(() => {
    __setBootContextForTesting(null);
    ctx.cleanup();
    rmSync(tmp, { recursive: true, force: true });
  });

  it("addPlaylistAction → sync_playlist → download_video → media_files written", async () => {
    const result = await addPlaylistAction({
      url: "https://www.youtube.com/playlist?list=PLfake_e2e",
      defaultFormat: "audio",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Process the sync_playlist job (which enqueues download_video jobs),
    // then process the download_video jobs. drainQueue loops until empty.
    await drainQueue(ctx);

    const detail = ctx.playlistService.getDetailFull(result.data.playlistId);
    expect(detail).not.toBeNull();
    expect(detail!.items.length).toBeGreaterThan(0);
    expect(detail!.items.some((i) => i.audioFile !== null)).toBe(true);
  }, 30_000);
});
