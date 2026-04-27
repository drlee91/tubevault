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

export interface JobSummary {
  queued: number;
  running: number;
  failed: number;
  completed24h: number;
}

export interface JobSubject {
  kind: "video" | "playlist";
  id: number;
  title: string;
}

export interface JobsListItem {
  id: number;
  type: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  priority: number;
  payload: unknown;
  lastError: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  nextAttemptAt: string | null;
  subject: JobSubject | null;
}

export interface JobsList {
  total: number;
  jobs: JobsListItem[];
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

  summary(): JobSummary {
    const rows = this.db
      .select({ status: jobs.status, c: sql<number>`count(*)` })
      .from(jobs)
      .groupBy(jobs.status)
      .all();
    const m = new Map(rows.map((r) => [r.status, Number(r.c)]));
    const completed24hRow = this.db.all<{ c: number }>(sql`
      SELECT COUNT(*) AS c FROM jobs
      WHERE status = 'completed' AND finished_at >= unixepoch('now', '-1 day')
    `)[0];
    const completed24h = completed24hRow ? Number(completed24hRow.c) : 0;
    return {
      queued: m.get("queued") ?? 0,
      running: m.get("running") ?? 0,
      failed: m.get("failed") ?? 0,
      completed24h,
    };
  }

  listWithSubjects(opts: { status?: string; limit: number; offset: number }): JobsList {
    type RawJobRow = {
      id: number;
      type: string;
      status: string;
      attempts: number;
      max_attempts: number;
      priority: number;
      payload: string;
      last_error: string | null;
      created_at: number;
      started_at: number | null;
      finished_at: number | null;
      next_attempt_at: number | null;
      subject_title: string | null;
      subject_id: number | null;
    };

    const toIso = (ts: number | null): string | null =>
      ts == null ? null : new Date(ts * 1000).toISOString();

    const buildSubject = (
      type: string,
      id: number | null,
      title: string | null,
    ): JobSubject | null => {
      if (id == null || title == null) return null;
      return {
        kind: type === "sync_playlist" ? "playlist" : "video",
        id: Number(id),
        title,
      };
    };

    if (opts.status != null) {
      const rows = this.db.all<RawJobRow>(sql`
        SELECT j.id, j.type, j.status, j.attempts, j.max_attempts, j.priority,
               j.payload, j.last_error, j.created_at, j.started_at, j.finished_at, j.next_attempt_at,
               CASE j.type
                 WHEN 'sync_playlist' THEN (SELECT title FROM playlists WHERE id = json_extract(j.payload, '$.playlistId'))
                 ELSE (SELECT title FROM videos WHERE id = json_extract(j.payload, '$.videoId'))
               END AS subject_title,
               CASE j.type
                 WHEN 'sync_playlist' THEN json_extract(j.payload, '$.playlistId')
                 ELSE json_extract(j.payload, '$.videoId')
               END AS subject_id
        FROM jobs j
        WHERE j.status = ${opts.status}
        ORDER BY j.created_at DESC
        LIMIT ${opts.limit} OFFSET ${opts.offset}
      `);
      const totalRow = this.db.all<{ c: number }>(sql`
        SELECT COUNT(*) AS c FROM jobs WHERE status = ${opts.status}
      `)[0];
      const total = totalRow ? Number(totalRow.c) : 0;
      return {
        total,
        jobs: rows.map((r) => ({
          id: r.id,
          type: r.type,
          status: r.status,
          attempts: r.attempts,
          maxAttempts: r.max_attempts,
          priority: r.priority,
          payload: typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload,
          lastError: r.last_error,
          createdAt: toIso(r.created_at) ?? new Date(0).toISOString(),
          startedAt: toIso(r.started_at),
          finishedAt: toIso(r.finished_at),
          nextAttemptAt: toIso(r.next_attempt_at),
          subject: buildSubject(r.type, r.subject_id, r.subject_title),
        })),
      };
    } else {
      const rows = this.db.all<RawJobRow>(sql`
        SELECT j.id, j.type, j.status, j.attempts, j.max_attempts, j.priority,
               j.payload, j.last_error, j.created_at, j.started_at, j.finished_at, j.next_attempt_at,
               CASE j.type
                 WHEN 'sync_playlist' THEN (SELECT title FROM playlists WHERE id = json_extract(j.payload, '$.playlistId'))
                 ELSE (SELECT title FROM videos WHERE id = json_extract(j.payload, '$.videoId'))
               END AS subject_title,
               CASE j.type
                 WHEN 'sync_playlist' THEN json_extract(j.payload, '$.playlistId')
                 ELSE json_extract(j.payload, '$.videoId')
               END AS subject_id
        FROM jobs j
        ORDER BY j.created_at DESC
        LIMIT ${opts.limit} OFFSET ${opts.offset}
      `);
      const totalRow = this.db.all<{ c: number }>(sql`
        SELECT COUNT(*) AS c FROM jobs
      `)[0];
      const total = totalRow ? Number(totalRow.c) : 0;
      return {
        total,
        jobs: rows.map((r) => ({
          id: r.id,
          type: r.type,
          status: r.status,
          attempts: r.attempts,
          maxAttempts: r.max_attempts,
          priority: r.priority,
          payload: typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload,
          lastError: r.last_error,
          createdAt: toIso(r.created_at) ?? new Date(0).toISOString(),
          startedAt: toIso(r.started_at),
          finishedAt: toIso(r.finished_at),
          nextAttemptAt: toIso(r.next_attempt_at),
          subject: buildSubject(r.type, r.subject_id, r.subject_title),
        })),
      };
    }
  }

  resetForRetry(jobId: number): void {
    this.db.run(sql`
      UPDATE jobs
      SET status = 'queued', attempts = 0, last_error = NULL,
          next_attempt_at = NULL, started_at = NULL, finished_at = NULL
      WHERE id = ${jobId}
    `);
  }
}
