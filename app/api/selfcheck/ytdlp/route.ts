import { z } from "zod";
import { ensureBootedOrTest } from "@/lib/api/helpers";

const schema = z.object({ path: z.string().min(1).optional() });

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(json);
  if (!parsed.success) return Response.json({ ok: false, error: "Invalid body" }, { status: 400 });
  const ctx = await ensureBootedOrTest();
  const result = await ctx.selfCheckService.checkYtdlp(parsed.data.path);
  return Response.json(result);
}
