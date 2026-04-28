import { describe, it, expect } from "vitest";
import { createTestDb } from "@/lib/db/__tests__/test-db";
import { VideoRepo } from "../video-repo";
import { MediaFileRepo } from "../media-file-repo";

function videoFor(db: ReturnType<typeof createTestDb>["db"]) {
  const repo = new VideoRepo(db);
  return repo.upsert({
    provider: "youtube",
    externalId: "v1",
    title: "T",
    channelTitle: null,
    durationSeconds: 100,
    thumbnailUrl: null,
    availabilityStatus: "available",
  });
}

describe("MediaFileRepo", () => {
  it("inserts and retrieves by (videoId, kind)", () => {
    const { db, sqlite } = createTestDb();
    try {
      const videoId = videoFor(db);
      const repo = new MediaFileRepo(db);
      const id = repo.insert({
        videoId,
        kind: "audio",
        filePath: "/p/a.mp3",
        format: "mp3",
        quality: "192kbps",
        fileSizeBytes: 100,
        durationSeconds: 100,
      });
      const row = repo.find(videoId, "audio");
      expect(row?.id).toBe(id);
      expect(row?.format).toBe("mp3");
    } finally {
      sqlite.close();
    }
  });

  it("delete removes the row", () => {
    const { db, sqlite } = createTestDb();
    try {
      const videoId = videoFor(db);
      const repo = new MediaFileRepo(db);
      const id = repo.insert({
        videoId,
        kind: "audio",
        filePath: "/p/a.mp3",
        format: "mp3",
        quality: "192kbps",
        fileSizeBytes: 100,
        durationSeconds: 100,
      });
      repo.delete(id);
      expect(repo.find(videoId, "audio")).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it("byId returns the row when present", () => {
    const { db, sqlite } = createTestDb();
    try {
      const videoId = videoFor(db);
      const repo = new MediaFileRepo(db);
      const id = repo.insert({
        videoId,
        kind: "audio",
        filePath: "/p/a.mp3",
        format: "mp3",
        quality: "192kbps",
        fileSizeBytes: 100,
        durationSeconds: 100,
      });
      const row = repo.byId(id);
      expect(row?.id).toBe(id);
      expect(row?.filePath).toBe("/p/a.mp3");
    } finally {
      sqlite.close();
    }
  });

  it("byId returns null for unknown id", () => {
    const { db, sqlite } = createTestDb();
    try {
      const repo = new MediaFileRepo(db);
      expect(repo.byId(99999)).toBeNull();
    } finally {
      sqlite.close();
    }
  });
});
