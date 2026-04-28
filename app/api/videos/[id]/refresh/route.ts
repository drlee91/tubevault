import { ensureBootedOrTest } from "@/lib/api/helpers";
import { VideoNotFoundError } from "@/lib/services/video-service";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await ensureBootedOrTest();
  try {
    const result = await ctx.videoService.enqueueRefresh(Number(id));
    return Response.json(result, { status: 202 });
  } catch (err) {
    if (err instanceof VideoNotFoundError) return Response.json({ error: { code: "VIDEO_NOT_FOUND", message: err.message } }, { status: 404 });
    throw err;
  }
}
