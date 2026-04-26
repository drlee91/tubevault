import { eq, and, desc } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { syncRuns } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";

export type SyncRunRow = typeof syncRuns.$inferSelect;

export interface StartRunInput {
  playlistId: number;
  triggeredBy: "manual" | "schedule" | "startup";
}

export interface FinishRunInput {
  status: "success" | "partial" | "failed";
  stats: {
    added: number;
    removed: number;
    unchanged: number;
    unavailable: number;
    downloaded?: number;
  };
  errorLog: Array<{ videoId?: number; code: string; message: string; timestamp: Date }>;
}

export class SyncRunRepo {
  constructor(private readonly db: BetterSQLite3Database<typeof schema>) {}

  startRun(input: StartRunInput): number {
    const [row] = this.db
      .insert(syncRuns)
      .values({
        playlistId: input.playlistId,
        startedAt: new Date(),
        status: "running",
        videosAdded: 0,
        videosRemoved: 0,
        videosUnavailable: 0,
        videosDownloaded: 0,
        triggeredBy: input.triggeredBy,
      })
      .returning({ id: syncRuns.id })
      .all();
    return row!.id;
  }

  finishRun(id: number, input: FinishRunInput): void {
    this.db
      .update(syncRuns)
      .set({
        finishedAt: new Date(),
        status: input.status,
        videosAdded: input.stats.added,
        videosRemoved: input.stats.removed,
        videosUnavailable: input.stats.unavailable,
        videosDownloaded: input.stats.downloaded ?? 0,
        errorLog: input.errorLog,
      })
      .where(eq(syncRuns.id, id))
      .run();
  }

  byId(id: number): SyncRunRow | null {
    return this.db.select().from(syncRuns).where(eq(syncRuns.id, id)).get() ?? null;
  }

  findRunning(playlistId: number): SyncRunRow | null {
    return (
      this.db
        .select()
        .from(syncRuns)
        .where(and(eq(syncRuns.playlistId, playlistId), eq(syncRuns.status, "running")))
        .get() ?? null
    );
  }

  recentByPlaylist(playlistId: number, limit = 10): SyncRunRow[] {
    return this.db
      .select()
      .from(syncRuns)
      .where(eq(syncRuns.playlistId, playlistId))
      .orderBy(desc(syncRuns.startedAt))
      .limit(limit)
      .all();
  }
}
