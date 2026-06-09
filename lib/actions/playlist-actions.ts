"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ensureBootedOrTest } from "@/lib/api/helpers";
import { mapServiceError } from "./map-error";
import { ok, fail, type ActionResult } from "./types";

const addSchema = z.object({
  url: z.string().url(),
  defaultFormat: z.enum(["audio", "video"]),
});

export async function addPlaylistAction(
  input: { url: string; defaultFormat: "audio" | "video" },
): Promise<ActionResult<{ playlistId: number; syncJobId: number }>> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) {
    return fail("VALIDATION_FAILED", "Invalid input", "url");
  }
  try {
    const ctx = await ensureBootedOrTest();
    const { playlist, syncJobId } = await ctx.playlistService.create(parsed.data);
    revalidatePath("/playlists");
    return ok({ playlistId: playlist.id, syncJobId });
  } catch (err) {
    return { ok: false, error: mapServiceError(err) };
  }
}

export async function syncPlaylistAction(
  playlistId: number,
): Promise<ActionResult<{ syncJobId: number }>> {
  try {
    const ctx = await ensureBootedOrTest();
    const playlist = ctx.playlistService.byId(playlistId);
    if (!playlist) return fail("PLAYLIST_NOT_FOUND", "Playlist not found");
    const syncJobId = await ctx.queue.enqueue(
      "sync_playlist",
      { playlistId },
      { priority: 20 },
    );
    revalidatePath(`/playlists/${playlistId}`);
    revalidatePath("/playlists");
    return ok({ syncJobId });
  } catch (err) {
    return { ok: false, error: mapServiceError(err) };
  }
}

export async function downloadMissingAction(
  playlistId: number,
): Promise<ActionResult<{ queued: number }>> {
  try {
    const ctx = await ensureBootedOrTest();
    const playlist = ctx.playlistService.byId(playlistId);
    if (!playlist) return fail("PLAYLIST_NOT_FOUND", "Playlist not found");
    const { queued } = await ctx.syncService.downloadMissing(playlistId);
    revalidatePath(`/playlists/${playlistId}`);
    return ok({ queued });
  } catch (err) {
    return { ok: false, error: mapServiceError(err) };
  }
}

export async function deletePlaylistAction(
  playlistId: number,
): Promise<ActionResult<{ deleted: true }>> {
  try {
    const ctx = await ensureBootedOrTest();
    await ctx.playlistService.delete(playlistId);
    revalidatePath("/playlists");
    return ok({ deleted: true });
  } catch (err) {
    return { ok: false, error: mapServiceError(err) };
  }
}
