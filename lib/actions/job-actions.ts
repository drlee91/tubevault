"use server";
import { ensureBootedOrTest } from "@/lib/api/helpers";
import { JobService } from "@/lib/services/job-service";
import { mapServiceError } from "./map-error";
import { ok, type ActionResult } from "./types";

export async function retryJobAction(jobId: number): Promise<ActionResult<{ retried: true }>> {
  try {
    const ctx = await ensureBootedOrTest();
    const svc = new JobService({ jobRepo: ctx.jobRepo, queue: ctx.queue });
    const r = await svc.retry(jobId);
    return ok(r);
  } catch (err) {
    return { ok: false, error: mapServiceError(err) };
  }
}
