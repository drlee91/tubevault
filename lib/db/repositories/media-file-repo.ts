import { eq, and } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { mediaFiles } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";

export type MediaFileRow = typeof mediaFiles.$inferSelect;

export interface InsertMediaFileInput {
  videoId: number;
  kind: "audio" | "video";
  filePath: string;
  format: string;
  quality: string;
  fileSizeBytes: number;
  durationSeconds: number;
}

export class MediaFileRepo {
  constructor(private readonly db: BetterSQLite3Database<typeof schema>) {}

  insert(input: InsertMediaFileInput): number {
    const [row] = this.db
      .insert(mediaFiles)
      .values({ ...input, downloadedAt: new Date() })
      .returning({ id: mediaFiles.id })
      .all();
    return row!.id;
  }

  find(videoId: number, kind: "audio" | "video"): MediaFileRow | null {
    return (
      this.db
        .select()
        .from(mediaFiles)
        .where(and(eq(mediaFiles.videoId, videoId), eq(mediaFiles.kind, kind)))
        .get() ?? null
    );
  }

  byVideoId(videoId: number): MediaFileRow[] {
    return this.db.select().from(mediaFiles).where(eq(mediaFiles.videoId, videoId)).all();
  }

  delete(id: number): void {
    this.db.delete(mediaFiles).where(eq(mediaFiles.id, id)).run();
  }
}
