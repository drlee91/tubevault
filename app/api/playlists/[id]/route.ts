import { NextResponse } from "next/server";
import { ensureBootedOrTest, jsonError } from "@/lib/api/helpers";

interface RouteContext { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctxParams: RouteContext) {
  try {
    const { id } = await ctxParams.params;
    const ctx = await ensureBootedOrTest();
    const detail = ctx.playlistService.getDetailFull(Number(id));
    if (!detail) {
      return NextResponse.json(
        { error: { code: "PLAYLIST_NOT_FOUND", message: "Playlist not found" } },
        { status: 404 },
      );
    }
    return NextResponse.json(detail);
  } catch (err) {
    return jsonError(err);
  }
}

export async function DELETE(_req: Request, ctxParams: RouteContext) {
  try {
    const { id } = await ctxParams.params;
    const ctx = await ensureBootedOrTest();
    await ctx.playlistService.delete(Number(id));
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return jsonError(err);
  }
}
