import { NextResponse } from "next/server";
import { ensureBooted } from "@/lib/boot";
import { jsonError } from "@/lib/api/helpers";

interface RouteContext { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctxParams: RouteContext) {
  try {
    const { id } = await ctxParams.params;
    const ctx = await ensureBooted();
    const video = ctx.videoService.byId(Number(id));
    if (!video) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: `video ${id} not found` } },
        { status: 404 },
      );
    }
    return NextResponse.json({ video });
  } catch (err) {
    return jsonError(err);
  }
}
