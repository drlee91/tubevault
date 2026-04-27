import { ensureBootedOrTest } from "@/lib/api/helpers";
import { JobService, JobNotFoundError, NotRetryableError } from "@/lib/services/job-service";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await ensureBootedOrTest();
  const svc = new JobService({ jobRepo: ctx.jobRepo, queue: ctx.queue });
  try {
    const result = await svc.retry(Number(id));
    return Response.json(result);
  } catch (err) {
    if (err instanceof JobNotFoundError) {
      return Response.json({ error: { code: "JOB_NOT_FOUND", message: err.message } }, { status: 404 });
    }
    if (err instanceof NotRetryableError) {
      return Response.json({ error: { code: "NOT_RETRYABLE", message: err.message } }, { status: 409 });
    }
    throw err;
  }
}
