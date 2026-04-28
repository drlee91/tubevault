import type { JobQueue } from "@/lib/jobs/queue";
import type { JobRepo, JobSummary, JobsList, JobsListItem } from "@/lib/db/repositories/job-repo";

export type { JobSummary, JobsList, JobsListItem };

export class JobNotFoundError extends Error {
  constructor(public readonly jobId: number) {
    super(`job not found: ${jobId}`);
    this.name = "JobNotFoundError";
  }
}

export class NotRetryableError extends Error {
  constructor(public readonly jobId: number, public readonly status: string) {
    super(`not retryable (status=${status})`);
    this.name = "NotRetryableError";
  }
}

export interface JobServiceDeps {
  jobRepo: JobRepo;
  queue: JobQueue;
}

export class JobService {
  constructor(private readonly d: JobServiceDeps) {}

  summary(): JobSummary {
    return this.d.jobRepo.summary();
  }

  list(opts: { status?: string; limit?: number; offset?: number }): JobsList {
    return this.d.jobRepo.listWithSubjects({
      status: opts.status,
      limit: opts.limit ?? 50,
      offset: opts.offset ?? 0,
    });
  }

  async retry(jobId: number): Promise<{ retried: true }> {
    const job = this.d.queue.byId(jobId);
    if (!job) throw new JobNotFoundError(jobId);
    if (job.status !== "failed") throw new NotRetryableError(jobId, job.status);
    this.d.jobRepo.resetForRetry(jobId);
    this.d.queue.signal();
    return { retried: true };
  }
}
