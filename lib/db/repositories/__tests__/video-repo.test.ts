import { describe, it, expect } from "vitest";
import { createTestDb } from "@/lib/db/__tests__/test-db";
import { VideoRepo } from "../video-repo";
import { MediaFileRepo } from "../media-file-repo";

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

  it("listStandaloneWithKinds includes availableKinds derived from media_files", () => {
    const { db, sqlite } = createTestDb();
    try {
      const videoRepo = new VideoRepo(db);
      const mediaRepo = new MediaFileRepo(db);
      const id = videoRepo.upsert({
        provider: "youtube", externalId: "v1", title: "T", channelTitle: null,
        durationSeconds: 1, thumbnailUrl: null, availabilityStatus: "available",
      });
      mediaRepo.insert({
        videoId: id, kind: "audio", filePath: "/p/a.mp3",
        format: "mp3", quality: "192", fileSizeBytes: 1, durationSeconds: 1,
      });
      const rows = videoRepo.listStandaloneWithKinds();
      expect(rows[0]!.availableKinds).toEqual(["audio"]);
    } finally {
      sqlite.close();
    }
  });
});
