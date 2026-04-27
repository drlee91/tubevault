"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ensureBootedOrTest } from "@/lib/api/helpers";
import { ok, fail, type ActionResult } from "./types";

const settingsPatchSchema = z.object({
  audioStoragePath: z.string().min(1).optional(),
  videoStoragePath: z.string().min(1).optional(),
  useSingleStoragePath: z.boolean().optional(),
  defaultAudioFormat: z.enum(["mp3", "m4a", "opus", "flac", "best"]).optional(),
  defaultAudioBitrate: z.enum(["128", "192", "256", "320", "vbr"]).optional(),
  defaultVideoQuality: z.enum(["480p", "720p", "1080p", "1440p", "2160p", "best"]).optional(),
  embedThumbnails: z.boolean().optional(),
  globalSyncCron: z.string().nullable().optional(),
  syncOnStartup: z.boolean().optional(),
  concurrency: z.number().int().min(1).max(10).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  ytdlpPath: z.string().nullable().optional(),
  ffmpegPath: z.string().nullable().optional(),
});

export async function updateSettingsAction(
  patch: z.input<typeof settingsPatchSchema>,
): Promise<ActionResult<{ updated: true }>> {
  const parsed = settingsPatchSchema.safeParse(patch);
  if (!parsed.success) {
    return fail("VALIDATION_FAILED", "Invalid settings");
  }
  try {
    const ctx = await ensureBootedOrTest();
    const s = ctx.settingsService;
    const p = parsed.data;

    if (p.audioStoragePath !== undefined) {
      const okPath = await ctx.selfCheckService.checkPathWritable(p.audioStoragePath);
      if (!okPath) return fail("STORAGE_PATH_INVALID", "Audio path is not writable", "audioStoragePath");
      s.setAudioStoragePath(p.audioStoragePath);
    }
    if (p.videoStoragePath !== undefined) {
      const okPath = await ctx.selfCheckService.checkPathWritable(p.videoStoragePath);
      if (!okPath) return fail("STORAGE_PATH_INVALID", "Video path is not writable", "videoStoragePath");
      s.setVideoStoragePath(p.videoStoragePath);
    }
    if (p.useSingleStoragePath !== undefined) s.setUseSingleStoragePath(p.useSingleStoragePath);
    if (p.defaultAudioFormat !== undefined) s.setDefaultAudioFormat(p.defaultAudioFormat);
    if (p.defaultAudioBitrate !== undefined) s.setDefaultAudioBitrate(p.defaultAudioBitrate);
    if (p.defaultVideoQuality !== undefined) s.setDefaultVideoQuality(p.defaultVideoQuality);
    if (p.embedThumbnails !== undefined) s.setEmbedThumbnails(p.embedThumbnails);
    if (p.globalSyncCron !== undefined) s.setGlobalSyncCron(p.globalSyncCron);
    if (p.syncOnStartup !== undefined) s.setSyncOnStartup(p.syncOnStartup);
    if (p.concurrency !== undefined) s.setConcurrency(p.concurrency);
    if (p.theme !== undefined) s.setTheme(p.theme);
    if (p.ytdlpPath !== undefined) s.setYtdlpPath(p.ytdlpPath);
    if (p.ffmpegPath !== undefined) s.setFfmpegPath(p.ffmpegPath);

    revalidatePath("/settings");
    return ok({ updated: true });
  } catch (err) {
    return fail("INTERNAL", err instanceof Error ? err.message : "Internal error");
  }
}
