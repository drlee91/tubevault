import { ensureBootedOrTest } from "@/lib/api/helpers";

export async function GET(_req: Request) {
  const ctx = await ensureBootedOrTest();
  return Response.json(ctx.mediaFileRepo.usageByKind());
}
