import { describe, it, expect } from "vitest";
import { createTestDb } from "@/lib/db/__tests__/test-db";
import { VideoRepo } from "../video-repo";

describe("VideoRepo", () => {
  it("upsert inserts when not present, updates when present", () => {
    const { db, sqlite } = createTestDb();
    try {
      const repo = new VideoRepo(db);
      const id1 = repo.upsert({
        provider: "youtube",
        externalId: "v1",
        title: "First",
        channelTitle: "C",
        durationSeconds: 100,
        thumbnailUrl: "t",
        availabilityStatus: "available",
      });
      const id2 = repo.upsert({
        provider: "youtube",
        externalId: "v1",
        title: "First (renamed)",
        channelTitle: "C",
        durationSeconds: 100,
        thumbnailUrl: "t",
        availabilityStatus: "available",
      });
      expect(id1).toBe(id2);
      expect(repo.byId(id1)!.title).toBe("First (renamed)");
    } finally {
      sqlite.close();
    }
  });

  it("byProviderExternalId returns null when missing", () => {
    const { db, sqlite } = createTestDb();
    try {
      const repo = new VideoRepo(db);
      expect(repo.byProviderExternalId("youtube", "missing")).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it("setAvailability updates availability_status and timestamp", () => {
    const { db, sqlite } = createTestDb();
    try {
      const repo = new VideoRepo(db);
      const id = repo.upsert({
        provider: "youtube",
        externalId: "v1",
        title: "x",
        channelTitle: null,
        durationSeconds: null,
        thumbnailUrl: null,
        availabilityStatus: "available",
      });
      repo.setAvailability(id, "removed", "removed by user");
      const row = repo.byId(id)!;
      expect(row.availabilityStatus).toBe("removed");
      expect(row.availabilityReason).toBe("removed by user");
    } finally {
      sqlite.close();
    }
  });
});
