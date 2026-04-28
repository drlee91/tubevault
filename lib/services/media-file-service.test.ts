import { describe, it, expect } from "vitest";
import { MediaFileService, mimeForFormat } from "./media-file-service";
import { createTestDb } from "@/lib/db/__tests__/test-db";
import { VideoRepo } from "@/lib/db/repositories/video-repo";
import { MediaFileRepo } from "@/lib/db/repositories/media-file-repo";

function seed(db: ReturnType<typeof createTestDb>["db"]) {
  const videoRepo = new VideoRepo(db);
  const mediaRepo = new MediaFileRepo(db);
  const videoId = videoRepo.upsert({
    provider: "youtube",
    externalId: "v1",
    title: "T",
    channelTitle: null,
    durationSeconds: 100,
    thumbnailUrl: null,
    availabilityStatus: "available",
  });
  const id = mediaRepo.insert({
    videoId,
    kind: "audio",
    filePath: "/p/a.mp3",
    format: "mp3",
    quality: "192kbps",
    fileSizeBytes: 100,
    durationSeconds: 100,
  });
  return { videoId, mediaFileId: id, mediaRepo };
}

describe("MediaFileService.byId", () => {
  it("returns the row when present", () => {
    const { db, sqlite } = createTestDb();
    try {
      const { mediaFileId, mediaRepo } = seed(db);
      const svc = new MediaFileService({ mediaFileRepo: mediaRepo });
      expect(svc.byId(mediaFileId)?.id).toBe(mediaFileId);
    } finally {
      sqlite.close();
    }
  });

  it("returns null for unknown id", () => {
    const { db, sqlite } = createTestDb();
    try {
      const { mediaRepo } = seed(db);
      const svc = new MediaFileService({ mediaFileRepo: mediaRepo });
      expect(svc.byId(99999)).toBeNull();
    } finally {
      sqlite.close();
    }
  });
});

describe("mimeForFormat", () => {
  it.each([
    ["mp3", "audio/mpeg"],
    ["m4a", "audio/mp4"],
    ["opus", "audio/ogg"],
    ["flac", "audio/flac"],
    ["mp4", "video/mp4"],
    ["webm", "video/webm"],
    ["mkv", "video/x-matroska"],
    ["xyz", "application/octet-stream"],
    ["", "application/octet-stream"],
  ])("maps %s to %s", (format, expected) => {
    expect(mimeForFormat(format)).toBe(expected);
  });
});
