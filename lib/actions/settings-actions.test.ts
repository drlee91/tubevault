import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { updateSettingsAction } from "./settings-actions";
import { createTestBootContext, type TestBootContext } from "@/lib/test-utils/boot-test-context";
import { __setBootContextForTesting } from "@/lib/test-utils/server-action-overrides";

describe("updateSettingsAction", () => {
  let ctx: TestBootContext;

  beforeEach(async () => {
    ctx = await createTestBootContext();
    __setBootContextForTesting(ctx);
  });

  afterEach(() => {
    __setBootContextForTesting(null);
    ctx.cleanup();
  });

  it("happy path — single field (concurrency)", async () => {
    const res = await updateSettingsAction({ concurrency: 5 });
    expect(res.ok).toBe(true);
    expect(ctx.settingsService.getConcurrency()).toBe(5);
  });

  it("happy path — multi field (defaultAudioFormat + embedThumbnails)", async () => {
    const res = await updateSettingsAction({
      defaultAudioFormat: "mp3",
      embedThumbnails: false,
    });
    expect(res.ok).toBe(true);
    expect(ctx.settingsService.getDefaultAudioFormat()).toBe("mp3");
    expect(ctx.settingsService.getEmbedThumbnails()).toBe(false);
  });

  it("happy path — boolean fields (syncOnStartup + useSingleStoragePath)", async () => {
    const res = await updateSettingsAction({
      syncOnStartup: true,
      useSingleStoragePath: true,
    });
    expect(res.ok).toBe(true);
    expect(ctx.settingsService.getSyncOnStartup()).toBe(true);
    expect(ctx.settingsService.getUseSingleStoragePath()).toBe(true);
  });

  it("happy path — defaultVideoQuality + defaultAudioBitrate + theme", async () => {
    const res = await updateSettingsAction({
      defaultVideoQuality: "720p",
      defaultAudioBitrate: "320",
      theme: "dark",
    });
    expect(res.ok).toBe(true);
    expect(ctx.settingsService.getDefaultVideoQuality()).toBe("720p");
    expect(ctx.settingsService.getDefaultAudioBitrate()).toBe("320");
    expect(ctx.settingsService.getTheme()).toBe("dark");
  });

  it("happy path — nullable fields (globalSyncCron + ytdlpPath + ffmpegPath)", async () => {
    const res = await updateSettingsAction({
      globalSyncCron: null,
      ytdlpPath: null,
      ffmpegPath: null,
    });
    expect(res.ok).toBe(true);
    expect(ctx.settingsService.getGlobalSyncCron()).toBe(null);
    expect(ctx.settingsService.getYtdlpPath()).toBe(null);
    expect(ctx.settingsService.getFfmpegPath()).toBe(null);
  });

  it("VALIDATION_FAILED — concurrency out of range (11)", async () => {
    const res = await updateSettingsAction({ concurrency: 11 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("VALIDATION_FAILED");
  });

  it("VALIDATION_FAILED — concurrency out of range (0)", async () => {
    const res = await updateSettingsAction({ concurrency: 0 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("VALIDATION_FAILED");
  });

  it("STORAGE_PATH_INVALID — non-existent audio path returns correct field", async () => {
    const res = await updateSettingsAction({
      audioStoragePath: "/non/existent/dir/that/should/never/exist",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("STORAGE_PATH_INVALID");
      expect(res.error.field).toBe("audioStoragePath");
    }
  });

  it("STORAGE_PATH_INVALID — non-existent video path returns correct field", async () => {
    const res = await updateSettingsAction({
      videoStoragePath: "/non/existent/dir/that/should/never/exist",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe("STORAGE_PATH_INVALID");
      expect(res.error.field).toBe("videoStoragePath");
    }
  });
});
