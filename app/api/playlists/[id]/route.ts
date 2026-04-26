import { NextResponse } from "next/server";
import { ensureBooted } from "@/lib/boot";
import { jsonError } from "@/lib/api/helpers";

interface RouteContext { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctxParams: RouteContext) {
  try {
    const { id } = await ctxParams.params;
    const ctx = await ensureBooted();
    const playlist = ctx.playlistService.byId(Number(id));
    if (!playlist) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: `playlist ${id} not found` } },
        { status: 404 },
      );
    }
    return NextResponse.json({
      playlist,
      items: [],
      recentSyncRuns: [],
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(_req: Request, ctxParams: RouteContext) {
  try {
    const { id } = await ctxParams.params;
    const ctx = await ensureBooted();
    await ctx.playlistService.delete(Number(id));
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return jsonError(err);
  }
}
