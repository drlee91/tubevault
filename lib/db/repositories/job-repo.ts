import { eq, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { jobs } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";

export type JobRow = typeof jobs.$inferSelect;
export type JobType = "sync_playlist" | "download_video" | "check_availability";
export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface InsertJobInput {
  type: JobType;
  payload: Record<string, unknown>;
  priority?: number;
  maxAttempts?: number;
}

export class JobRepo {
  constructor(private readonly db: BetterSQLite3Database<typeof schema>) {}

  insert(input: InsertJobInput): number {
    const [row] = this.db
      .insert(jobs)
      .values({
        type: input.type,
        payload: input.payload,
        status: "queued",
        priority: input.priority ?? 0,
        attempts: 0,
        maxAttempts: input.maxAttempts ?? 3,
        createdAt: new Date(),
      })
      .returning({ id: jobs.id })
      .all();
    return row!.id;
  }

  byId(id: number): JobRow | null {
    return this.db.select().from(jobs).where(eq(jobs.id, id)).get() ?? null;
  }

  countByStatus(): Record<JobStatus, number> {
    const rows = this.db
      .select({ status: jobs.status, count: sql<number>`count(*)` })
      .from(jobs)
      .groupBy(jobs.status)
      .all();
    const result: Record<JobStatus, number> = {
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };
    for (const r of rows) result[r.status as JobStatus] = r.count;
    return result;
  }
}
