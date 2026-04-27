import { ensureBootedOrTest } from "@/lib/api/helpers";
import { JobService } from "@/lib/services/job-service";

export async function GET(_req: Request) {
  const ctx = await ensureBootedOrTest();
  const svc = new JobService({ jobRepo: ctx.jobRepo, queue: ctx.queue });
  return Response.json(svc.summary());
}
