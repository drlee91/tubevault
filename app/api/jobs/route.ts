import { z } from "zod";
import { ensureBootedOrTest } from "@/lib/api/helpers";
import { JobService } from "@/lib/services/job-service";

const querySchema = z.object({
  status: z.enum(["queued", "running", "completed", "failed", "cancelled"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return Response.json(
      { error: { code: "VALIDATION_FAILED", message: "Invalid query", details: parsed.error.flatten() } },
      { status: 400 },
    );
  }
  const ctx = await ensureBootedOrTest();
  const svc = new JobService({ jobRepo: ctx.jobRepo, queue: ctx.queue });
  return Response.json(svc.list(parsed.data));
}
