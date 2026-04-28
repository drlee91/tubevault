import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { eq, sql } from "drizzle-orm";
import { jobs } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import type { JobRepo } from "@/lib/db/repositories/job-repo";
import type { JobRow, JobType, WorkerSignaler } from "./types";
import { backoffMs } from "@/lib/utils/backoff";

export interface EnqueueOptions {
  priority?: number;
  maxAttempts?: number;
}

export class JobQueue {
  private worker: WorkerSignaler | null = null;

  constructor(
    private readonly db: BetterSQLite3Database<typeof schema>,
    private readonly repo: JobRepo,
  ) {}

  attachWorker(w: WorkerSignaler): void {
    this.worker = w;
  }

  async enqueue(
    type: JobType,
    payload: Record<string, unknown>,
    opts: EnqueueOptions = {},
  ): Promise<number> {
    const id = this.repo.insert({
      type,
      payload,
      priority: opts.priority,
      maxAttempts: opts.maxAttempts,
    });
    this.worker?.signal();
    return id;
  }

  async claim(): Promise<JobRow | null> {
    const nowSec = Math.floor(Date.now() / 1000);
    const claimSql = sql`
      UPDATE jobs
      SET status = 'running',
          started_at = ${nowSec},
          attempts = attempts + 1
      WHERE id = (
        SELECT id FROM jobs
        WHERE status = 'queued'
          AND (next_attempt_at IS NULL OR next_attempt_at <= ${nowSec})
        ORDER BY priority DESC, created_at ASC
        LIMIT 1
      )
      RETURNING *
    `;
    const result = this.db.all<JobRow>(claimSql);
    const row = result[0] ?? null;
    // drizzle's JSON mode is not applied to raw SQL results — parse manually.
    if (row && typeof row.payload === "string") {
      return { ...row, payload: JSON.parse(row.payload as unknown as string) };
    }
    return row;
  }

  async complete(id: number): Promise<void> {
    this.db
      .update(jobs)
      .set({ status: "completed", finishedAt: new Date() })
      .where(eq(jobs.id, id))
      .run();
  }

  async fail(id: number, error: string, transient: boolean): Promise<void> {
    const job = this.repo.byId(id);
    if (!job) return;
    const reachedMax = job.attempts >= job.maxAttempts;
    if (!transient || reachedMax) {
      this.db
        .update(jobs)
        .set({ status: "failed", lastError: error, finishedAt: new Date() })
        .where(eq(jobs.id, id))
        .run();
      return;
    }
    const nextAttemptAt = new Date(Date.now() + backoffMs(job.attempts));
    this.db
      .update(jobs)
      .set({ status: "queued", lastError: error, nextAttemptAt, startedAt: null })
      .where(eq(jobs.id, id))
      .run();
  }

  async resetStaleRunning(): Promise<number> {
    const result = this.db
      .update(jobs)
      .set({ status: "queued", startedAt: null })
      .where(eq(jobs.status, "running"))
      .run();
    return result.changes;
  }

  signal(): void {
    this.worker?.signal();
  }

  byId(id: number): import("./types").JobRow | null {
    return this.repo.byId(id);
  }
}
