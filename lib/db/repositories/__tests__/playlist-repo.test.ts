import { describe, it, expect } from "vitest";
import { createTestDb } from "@/lib/db/__tests__/test-db";
import { PlaylistRepo } from "../playlist-repo";
import { VideoRepo } from "../video-repo";
import { PlaylistItemRepo } from "../playlist-item-repo";
import { MediaFileRepo } from "../media-file-repo";

describe("PlaylistRepo", () => {
  it("inserts and reads back a playlist", () => {
    const { db, sqlite } = createTestDb();
    try {
      const repo = new PlaylistRepo(db);
      const id = repo.create({
        provider: "youtube",
        externalId: "PL1",
        url: "https://www.youtube.com/playlist?list=PL1",
        defaultFormat: "audio",
      });
      const row = repo.byId(id);
      expect(row).toMatchObject({
        provider: "youtube",
        externalId: "PL1",
        defaultFormat: "audio",
        syncEnabled: true,
      });
    } finally {
      sqlite.close();
    }
  });

  it("byProviderExternalId looks up by natural key", () => {
    const { db, sqlite } = createTestDb();
    try {
      const repo = new PlaylistRepo(db);
      repo.create({ provider: "youtube", externalId: "PL1", url: "u", defaultFormat: "audio" });
      expect(repo.byProviderExternalId("youtube", "PL1")).not.toBeNull();
      expect(repo.byProviderExternalId("youtube", "missing")).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it("touchLastSyncedAt updates the timestamp", () => {
    const { db, sqlite } = createTestDb();
    try {
      const repo = new PlaylistRepo(db);
      const id = repo.create({ provider: "youtube", externalId: "PL1", url: "u", defaultFormat: "audio" });
      repo.touchLastSyncedAt(id);
      const row = repo.byId(id)!;
      expect(row.lastSyncedAt).not.toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it("delete removes the row", () => {
    const { db, sqlite } = createTestDb();
    try {
      const repo = new PlaylistRepo(db);
      const id = repo.create({ provider: "youtube", externalId: "PL1", url: "u", defaultFormat: "audio" });
      repo.delete(id);
      expect(repo.byId(id)).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it("list returns all playlists", () => {
    const { db, sqlite } = createTestDb();
    try {
      const repo = new PlaylistRepo(db);
      repo.create({ provider: "youtube", externalId: "PL1", url: "u1", defaultFormat: "audio" });
      repo.create({ provider: "youtube", externalId: "PL2", url: "u2", defaultFormat: "video" });
      expect(repo.list()).toHaveLength(2);
    } finally {
      sqlite.close();
    }
  });

  it("downloadedItems counts only items with BOTH audio and video files", () => {
    const { db, sqlite } = createTestDb();
    try {
      const repo = new PlaylistRepo(db);
      const videoRepo = new VideoRepo(db);
      const itemRepo = new PlaylistItemRepo(db);
      const mediaRepo = new MediaFileRepo(db);
      const id = repo.create({ provider: "youtube", externalId: "PL1", url: "u", defaultFormat: "audio" });
      const complete = videoRepo.upsert({
        provider: "youtube", externalId: "v-complete", title: "c", channelTitle: null,
        durationSeconds: 1, thumbnailUrl: null, availabilityStatus: "available",
      });
      const half = videoRepo.upsert({
        provider: "youtube", externalId: "v-half", title: "h", channelTitle: null,
        durationSeconds: 1, thumbnailUrl: null, availabilityStatus: "available",
      });
      itemRepo.upsertActive(id, complete, 0);
      itemRepo.upsertActive(id, half, 1);
      for (const kind of ["audio", "video"] as const) {
        mediaRepo.insert({ videoId: complete, kind, filePath: `/x/c.${kind}`, format: kind === "audio" ? "mp3" : "mp4", quality: "q", fileSizeBytes: 1, durationSeconds: 1 });
      }
      mediaRepo.insert({ videoId: half, kind: "audio", filePath: "/x/h.mp3", format: "mp3", quality: "q", fileSizeBytes: 1, durationSeconds: 1 });

      expect(repo.byIdWithStats(id)!.stats.downloadedItems).toBe(1);
      expect(repo.listWithStats()[0]!.stats.downloadedItems).toBe(1);
    } finally {
      sqlite.close();
    }
  });

  it("coverThumbs returns thumbnail urls in position order, skipping nulls", () => {
    const { db, sqlite } = createTestDb();
    try {
      const repo = new PlaylistRepo(db);
      const videoRepo = new VideoRepo(db);
      const itemRepo = new PlaylistItemRepo(db);
      const id = repo.create({ provider: "youtube", externalId: "PL1", url: "u", defaultFormat: "audio" });
      const v1 = videoRepo.upsert({
        provider: "youtube", externalId: "v1", title: "V1", channelTitle: null,
        durationSeconds: 1, thumbnailUrl: "https://img.youtube.com/vi/v1/0.jpg", availabilityStatus: "available",
      });
      const v2 = videoRepo.upsert({
        provider: "youtube", externalId: "v2", title: "V2", channelTitle: null,
        durationSeconds: 1, thumbnailUrl: "https://img.youtube.com/vi/v2/0.jpg", availabilityStatus: "available",
      });
      const v3 = videoRepo.upsert({
        provider: "youtube", externalId: "v3", title: "V3", channelTitle: null,
        durationSeconds: 1, thumbnailUrl: null, availabilityStatus: "available",
      });
      itemRepo.upsertActive(id, v1, 0);
      itemRepo.upsertActive(id, v2, 1);
      itemRepo.upsertActive(id, v3, 2);

      const row = repo.byIdWithStats(id)!;
      expect(row.coverThumbs).toEqual([
        "https://img.youtube.com/vi/v1/0.jpg",
        "https://img.youtube.com/vi/v2/0.jpg",
      ]);
    } finally {
      sqlite.close();
    }
  });

  it("coverThumbs is empty array when playlist has no thumbnails", () => {
    const { db, sqlite } = createTestDb();
    try {
      const repo = new PlaylistRepo(db);
      const id = repo.create({ provider: "youtube", externalId: "PL2", url: "u2", defaultFormat: "audio" });
      expect(repo.byIdWithStats(id)!.coverThumbs).toEqual([]);
    } finally {
      sqlite.close();
    }
  });

  // Raw-SQL stats queries bypass drizzle's timestamp mapping; the mapper must
  // convert Unix seconds to ISO or <RelativeTime> renders "NaNy ago".
  it("stats rows expose parseable ISO timestamps, not raw Unix seconds", () => {
    const { db, sqlite } = createTestDb();
    try {
      const repo = new PlaylistRepo(db);
      const id = repo.create({ provider: "youtube", externalId: "PL1", url: "u", defaultFormat: "audio" });
      repo.touchLastSyncedAt(id);

      for (const row of [repo.byIdWithStats(id)!, repo.listWithStats()[0]!]) {
        expect(Number.isNaN(new Date(row.createdAt).getTime())).toBe(false);
        expect(row.lastSyncedAt).not.toBeNull();
        expect(Number.isNaN(new Date(row.lastSyncedAt!).getTime())).toBe(false);
      }
    } finally {
      sqlite.close();
    }
  });
});
