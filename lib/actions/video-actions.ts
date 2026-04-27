"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ensureBootedOrTest } from "@/lib/api/helpers";
import { mapServiceError } from "./map-error";
import { ok, fail, type ActionResult } from "./types";

const addVideoSchema = z.object({
  url: z.string().url(),
  format: z.enum(["audio", "video"]),
});

export async function addVideoAction(
  input: { url: string; format: "audio" | "video" },
): Promise<ActionResult<{ videoId: number; downloadJobId: number }>> {
  const parsed = addVideoSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_FAILED", "Invalid input", "url");
  }
  try {
    const ctx = await ensureBootedOrTest();
    const { video, downloadJobId } = await ctx.videoService.addStandalone(parsed.data);
    revalidatePath("/playlists");
    return ok({ videoId: video.id, downloadJobId });
  } catch (err) {
    return { ok: false, error: mapServiceError(err) };
  }
}

export async function downloadVideoAction(
  videoId: number,
  kind: "audio" | "video",
): Promise<ActionResult<{ jobId: number }>> {
  try {
    const ctx = await ensureBootedOrTest();
    const { jobId } = await ctx.videoService.forceDownload(videoId, kind);
    return ok({ jobId });
  } catch (err) {
    return { ok: false, error: mapServiceError(err) };
  }
}

export async function refreshVideoAction(
  videoId: number,
): Promise<ActionResult<{ jobId: number }>> {
  try {
    const ctx = await ensureBootedOrTest();
    const { jobId } = await ctx.videoService.enqueueRefresh(videoId);
    return ok({ jobId });
  } catch (err) {
    return { ok: false, error: mapServiceError(err) };
  }
}
