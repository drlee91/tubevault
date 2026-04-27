import { z } from "zod";
import { ensureBootedOrTest } from "@/lib/api/helpers";
import { VideoNotAvailableError, VideoNotFoundError } from "@/lib/services/video-service";

const bodySchema = z.object({ kind: z.enum(["audio", "video"]) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: { code: "VALIDATION_FAILED", message: "Invalid body", details: parsed.error.flatten() } },
      { status: 400 },
    );
  }
  const ctx = await ensureBootedOrTest();
  try {
    const result = await ctx.videoService.forceDownload(Number(id), parsed.data.kind);
    return Response.json(result, { status: 202 });
  } catch (err) {
    if (err instanceof VideoNotFoundError) return Response.json({ error: { code: "VIDEO_NOT_FOUND", message: err.message } }, { status: 404 });
    if (err instanceof VideoNotAvailableError) return Response.json({ error: { code: "VIDEO_NOT_AVAILABLE", message: err.message } }, { status: 409 });
    throw err;
  }
}
