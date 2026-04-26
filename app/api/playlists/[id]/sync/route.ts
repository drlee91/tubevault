import { NextResponse } from "next/server";
import { ensureBooted } from "@/lib/boot";
import { jsonError } from "@/lib/api/helpers";

interface RouteContext { params: Promise<{ id: string }> }

export async function POST(_req: Request, ctxParams: RouteContext) {
  try {
    const { id } = await ctxParams.params;
    const playlistId = Number(id);
    const ctx = await ensureBooted();
    const playlist = ctx.playlistService.byId(playlistId);
    if (!playlist) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: `playlist ${id} not found` } },
        { status: 404 },
      );
    }
    const syncJobId = await ctx.queue.enqueue("sync_playlist", { playlistId }, { priority: 20 });
    return NextResponse.json({ syncJobId }, { status: 202 });
  } catch (err) {
    return jsonError(err);
  }
}
