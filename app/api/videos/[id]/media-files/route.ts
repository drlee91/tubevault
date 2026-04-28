import { ensureBootedOrTest } from "@/lib/api/helpers";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const videoId = Number(id);
  if (!Number.isFinite(videoId)) return new Response("Not Found", { status: 404 });
  const boot = await ensureBootedOrTest();
  const video = boot.videoService.byId(videoId);
  if (!video) return new Response("Not Found", { status: 404 });
  const files = boot.mediaFileRepo.byVideoId(videoId);
  const audio = files.find((f) => f.kind === "audio")?.id ?? null;
  const videoFile = files.find((f) => f.kind === "video")?.id ?? null;
  return Response.json({ audio, video: videoFile });
}
