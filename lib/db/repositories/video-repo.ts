import { eq, and } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { videos } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";
import type { AvailabilityStatus, ProviderId } from "@/lib/providers/types";

export type VideoRow = typeof videos.$inferSelect;

export interface UpsertVideoInput {
  provider: ProviderId;
  externalId: string;
  title: string;
  channelTitle: string | null;
  channelId?: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  availabilityStatus: AvailabilityStatus;
  availabilityReason?: string | null;
}

export class VideoRepo {
  constructor(private readonly db: BetterSQLite3Database<typeof schema>) {}

  upsert(input: UpsertVideoInput): number {
    const now = new Date();
    const existing = this.byProviderExternalId(input.provider, input.externalId);
    if (existing) {
      this.db
        .update(videos)
        .set({
          title: input.title,
          channelTitle: input.channelTitle,
          channelId: input.channelId ?? existing.channelId,
          durationSeconds: input.durationSeconds,
          thumbnailUrl: input.thumbnailUrl,
          availabilityStatus: input.availabilityStatus,
          availabilityReason: input.availabilityReason ?? null,
          availabilityChangedAt:
            existing.availabilityStatus === input.availabilityStatus
              ? existing.availabilityChangedAt
              : now,
          lastSeenAt: now,
          updatedAt: now,
        })
        .where(eq(videos.id, existing.id))
        .run();
      return existing.id;
    }
    const [row] = this.db
      .insert(videos)
      .values({
        provider: input.provider,
        externalId: input.externalId,
        title: input.title,
        channelTitle: input.channelTitle,
        channelId: input.channelId ?? null,
        durationSeconds: input.durationSeconds,
        thumbnailUrl: input.thumbnailUrl,
        availabilityStatus: input.availabilityStatus,
        availabilityReason: input.availabilityReason ?? null,
        availabilityChangedAt: now,
        firstSeenAt: now,
        lastSeenAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: videos.id })
      .all();
    return row!.id;
  }

  byId(id: number): VideoRow | null {
    return this.db.select().from(videos).where(eq(videos.id, id)).get() ?? null;
  }

  byProviderExternalId(provider: ProviderId, externalId: string): VideoRow | null {
    return (
      this.db
        .select()
        .from(videos)
        .where(and(eq(videos.provider, provider), eq(videos.externalId, externalId)))
        .get() ?? null
    );
  }

  setAvailability(id: number, status: AvailabilityStatus, reason: string | null): void {
    this.db
      .update(videos)
      .set({
        availabilityStatus: status,
        availabilityReason: reason,
        availabilityChangedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(videos.id, id))
      .run();
  }
}
