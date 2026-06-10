import { describe, it, expect } from "vitest";
import { createTestDb } from "@/lib/db/__tests__/test-db";
import { PlaylistRepo } from "../playlist-repo";
import { VideoRepo } from "../video-repo";
import { PlaylistItemRepo } from "../playlist-item-repo";
import { MediaFileRepo } from "../media-file-repo";
import { JobRepo } from "../job-repo";
import { JobQueue } from "@/lib/jobs/queue";

function setup() {
  const { db, sqlite } = createTestDb();
  const playlists = new PlaylistRepo(db);
  const videos = new VideoRepo(db);
  const items = new PlaylistItemRepo(db);
  const playlistId = playlists.create({
    provider: "youtube",
    externalId: "PL",
    url: "u",
    defaultFormat: "audio",
  });
  return { db, sqlite, playlists, videos, items, playlistId };
}

describe("PlaylistItemRepo", () => {
  it("upsertActive inserts and updates position", () => {
    const { sqlite, videos, items, playlistId } = setup();
    try {
      const v = videos.upsert({
        provider: "youtube",
        externalId: "v1",
        title: "x",
        channelTitle: null,
        durationSeconds: null,
        thumbnailUrl: null,
        availabilityStatus: "available",
      });
      items.upsertActive(playlistId, v, 0);
      items.upsertActive(playlistId, v, 5);
      const active = items.activeExternalIdsByPlaylist(playlistId);
      expect(active).toEqual(["v1"]);
    } finally {
      sqlite.close();
    }
  });

  it("markRemoved sets in_playlist=false and timestamp", () => {
    const { sqlite, videos, items, playlistId } = setup();
    try {
      const v = videos.upsert({
        provider: "youtube",
        externalId: "v1",
        title: "x",
        channelTitle: null,
        durationSeconds: null,
        thumbnailUrl: null,
        availabilityStatus: "available",
      });
      items.upsertActive(playlistId, v, 0);
      items.markRemoved(playlistId, v);
      expect(items.activeExternalIdsByPlaylist(playlistId)).toEqual([]);
    } finally {
      sqlite.close();
    }
  });

  it("listWithJoinsForDetail returns availableKinds derived from media_files", () => {
    const { db, sqlite } = createTestDb();
    try {
      const playlistRepo = new PlaylistRepo(db);
      const videoRepo = new VideoRepo(db);
      const itemRepo = new PlaylistItemRepo(db);
      const mediaRepo = new MediaFileRepo(db);
      const pid = playlistRepo.create({
        provider: "youtube",
        externalId: "PL1",
        url: "u",
        defaultFormat: "audio",
        title: "p",
      });
      const vid = videoRepo.upsert({
        provider: "youtube", externalId: "v", title: "T", channelTitle: null,
        durationSeconds: 1, thumbnailUrl: null, availabilityStatus: "available",
      });
      itemRepo.upsertActive(pid, vid, 0);
      mediaRepo.insert({
        videoId: vid, kind: "audio", filePath: "/p/a.mp3",
        format: "mp3", quality: "192", fileSizeBytes: 1, durationSeconds: 1,
      });
      const items = itemRepo.listWithJoinsForDetail(pid);
      expect(items[0]!.availableKinds).toEqual(["audio"]);
    } finally {
      sqlite.close();
    }
  });

  // Same raw-query caveat as PlaylistRepo stats: added_at / downloaded_at come
  // back as Unix seconds and must be mapped to ISO for <RelativeTime>.
  it("listWithJoinsForDetail returns parseable ISO timestamps", () => {
    const { db, sqlite } = createTestDb();
    try {
      const playlistRepo = new PlaylistRepo(db);
      const videoRepo = new VideoRepo(db);
      const itemRepo = new PlaylistItemRepo(db);
      const mediaRepo = new MediaFileRepo(db);
      const pid = playlistRepo.create({
        provider: "youtube", externalId: "PL1", url: "u", defaultFormat: "audio", title: "p",
      });
      const vid = videoRepo.upsert({
        provider: "youtube", externalId: "v", title: "T", channelTitle: null,
        durationSeconds: 1, thumbnailUrl: null, availabilityStatus: "available",
      });
      itemRepo.upsertActive(pid, vid, 0);
      mediaRepo.insert({
        videoId: vid, kind: "audio", filePath: "/p/a.mp3",
        format: "mp3", quality: "192", fileSizeBytes: 1, durationSeconds: 1,
      });
      const item = itemRepo.listWithJoinsForDetail(pid)[0]!;
      expect(Number.isNaN(new Date(item.addedAt).getTime())).toBe(false);
      expect(Number.isNaN(new Date(item.audioFile!.downloadedAt).getTime())).toBe(false);
    } finally {
      sqlite.close();
    }
  });

  it("exposes per-kind pending download jobs", async () => {
    const { db, sqlite } = createTestDb();
    try {
      const playlistRepo = new PlaylistRepo(db);
      const videoRepo = new VideoRepo(db);
      const itemRepo = new PlaylistItemRepo(db);
      const jobRepo = new JobRepo(db);
      const queue = new JobQueue(db, jobRepo);
      const pid = playlistRepo.create({
        provider: "youtube", externalId: "PL1", url: "u", defaultFormat: "audio", title: "p",
      });
      const vid = videoRepo.upsert({
        provider: "youtube", externalId: "v", title: "T", channelTitle: null,
        durationSeconds: 1, thumbnailUrl: null, availabilityStatus: "available",
      });
      itemRepo.upsertActive(pid, vid, 0);
      await queue.enqueue("download_video", { videoId: vid, kind: "audio" }, { priority: 5 });
      // a kind-less job type must not leak into either slot
      await queue.enqueue("check_availability", { videoId: vid }, { priority: 10 });

      const item = itemRepo.listWithJoinsForDetail(pid)[0]!;
      expect(item.pendingJobs.audio?.status).toBe("queued");
      expect(item.pendingJobs.video).toBeNull();
    } finally {
      sqlite.close();
    }
  });
});
