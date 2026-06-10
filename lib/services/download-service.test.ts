import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createTestDb } from "@/lib/db/__tests__/test-db";
import { VideoRepo } from "@/lib/db/repositories/video-repo";
import { MediaFileRepo } from "@/lib/db/repositories/media-file-repo";
import { ProviderRegistry } from "@/lib/providers/registry";
import { FakeAdapter } from "@/lib/providers/__tests__/fake-adapter";
import { MediaUnavailableError } from "@/lib/providers/types";
import { DownloadService, VideoBecameUnavailableError, type DownloadServiceSettings } from "./download-service";

async function tmpdir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "tubevault-dl-"));
}

function settingsFor(audioPath: string, videoPath: string, single = false): DownloadServiceSettings {
  return {
    audioStoragePath: audioPath,
    videoStoragePath: videoPath,
    useSingleStoragePath: single,
    defaultAudioFormat: "mp3",
    defaultAudioBitrate: 192,
    defaultVideoQuality: "1080p",
  };
}

describe("DownloadService", () => {
  it("downloads to audioStoragePath, sanitizes filename, writes media_files", async () => {
    const { db, sqlite } = createTestDb();
    try {
      const videoRepo = new VideoRepo(db);
      const mediaRepo = new MediaFileRepo(db);
      const registry = new ProviderRegistry();
      const audioDir = await tmpdir();
      const videoDir = await tmpdir();
      const filePath = path.join(audioDir, "Test- Title-abc111.mp3");
      await fs.writeFile(filePath, Buffer.alloc(1234));
      registry.register(new FakeAdapter({
        downloadResult: () => ({ filePath, format: "mp3", quality: "192kbps", fileSizeBytes: 1234, durationSeconds: 100 }),
      }));
      const videoId = videoRepo.upsert({
        provider: "youtube", externalId: "abc111", title: "Test/Title",
        channelTitle: "C", durationSeconds: 100, thumbnailUrl: null, availabilityStatus: "available",
      });
      const svc = new DownloadService({ videoRepo, mediaRepo, registry, settings: () => settingsFor(audioDir, videoDir) });
      const row = await svc.download(videoId, "audio");
      expect(row.filePath).toBe(filePath);
      expect(row.format).toBe("mp3");
    } finally {
      sqlite.close();
    }
  });

  it("uses audioStoragePath for video kind when useSingleStoragePath=true", async () => {
    const { db, sqlite } = createTestDb();
    try {
      const videoRepo = new VideoRepo(db);
      const mediaRepo = new MediaFileRepo(db);
      const registry = new ProviderRegistry();
      const single = await tmpdir();
      const filePath = path.join(single, "v.mp4");
      await fs.writeFile(filePath, Buffer.alloc(10));
      let receivedDir = "";
      registry.register(new FakeAdapter({
        downloadResult: (_id, opts) => {
          receivedDir = opts.outputDir;
          return { filePath, format: "mp4", quality: "1080p", fileSizeBytes: 10, durationSeconds: 1 };
        },
      }));
      const videoId = videoRepo.upsert({
        provider: "youtube", externalId: "v", title: "v",
        channelTitle: null, durationSeconds: 1, thumbnailUrl: null, availabilityStatus: "available",
      });
      const svc = new DownloadService({ videoRepo, mediaRepo, registry, settings: () => settingsFor(single, "/other", true) });
      await svc.download(videoId, "video");
      expect(receivedDir).toBe(single);
    } finally {
      sqlite.close();
    }
  });

  it("overwrites existing media file row + tries to delete old file", async () => {
    const { db, sqlite } = createTestDb();
    try {
      const videoRepo = new VideoRepo(db);
      const mediaRepo = new MediaFileRepo(db);
      const registry = new ProviderRegistry();
      const dir = await tmpdir();
      const oldPath = path.join(dir, "old.mp3");
      const newPath = path.join(dir, "new.mp3");
      await fs.writeFile(oldPath, Buffer.alloc(1));
      await fs.writeFile(newPath, Buffer.alloc(2));
      registry.register(new FakeAdapter({
        downloadResult: () => ({ filePath: newPath, format: "mp3", quality: "192kbps", fileSizeBytes: 2, durationSeconds: 1 }),
      }));
      const videoId = videoRepo.upsert({
        provider: "youtube", externalId: "x", title: "t",
        channelTitle: null, durationSeconds: 1, thumbnailUrl: null, availabilityStatus: "available",
      });
      mediaRepo.insert({ videoId, kind: "audio", filePath: oldPath, format: "mp3", quality: "192kbps", fileSizeBytes: 1, durationSeconds: 1 });
      const svc = new DownloadService({ videoRepo, mediaRepo, registry, settings: () => settingsFor(dir, dir) });
      await svc.download(videoId, "audio");
      const rows = mediaRepo.byVideoId(videoId);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.filePath).toBe(newPath);
      await expect(fs.access(oldPath)).rejects.toThrow();
    } finally {
      sqlite.close();
    }
  });

  it("passes the configured cookie browser through to the adapter", async () => {
    const { db, sqlite } = createTestDb();
    try {
      const videoRepo = new VideoRepo(db);
      const mediaRepo = new MediaFileRepo(db);
      const registry = new ProviderRegistry();
      const dir = await tmpdir();
      const filePath = path.join(dir, "t.mp3");
      await fs.writeFile(filePath, Buffer.alloc(1));
      let captured: string | null | undefined;
      registry.register(new FakeAdapter({
        downloadResult: (_id, opts) => {
          captured = opts.cookiesFromBrowser;
          return { filePath, format: "mp3", quality: "192kbps", fileSizeBytes: 1, durationSeconds: 1 };
        },
      }));
      const videoId = videoRepo.upsert({
        provider: "youtube", externalId: "c1", title: "t",
        channelTitle: null, durationSeconds: 1, thumbnailUrl: null, availabilityStatus: "available",
      });
      const svc = new DownloadService({
        videoRepo, mediaRepo, registry,
        settings: () => ({ ...settingsFor(dir, dir), cookiesFromBrowser: "firefox" }),
      });
      await svc.download(videoId, "audio");
      expect(captured).toBe("firefox");
    } finally {
      sqlite.close();
    }
  });

  it("re-throws MediaUnavailableError from adapter as VideoBecameUnavailableError with videoId", async () => {
    const { db, sqlite } = createTestDb();
    try {
      const videoRepo = new VideoRepo(db);
      const mediaRepo = new MediaFileRepo(db);
      const registry = new ProviderRegistry();
      registry.register(new FakeAdapter({
        downloadResult: () => { throw new MediaUnavailableError("ext1", "Video unavailable: gone"); },
      }));
      const videoId = videoRepo.upsert({
        provider: "youtube", externalId: "ext1", title: "Gone Video",
        channelTitle: null, durationSeconds: 60, thumbnailUrl: null, availabilityStatus: "available",
      });
      const svc = new DownloadService({
        videoRepo, mediaRepo, registry,
        settings: () => ({
          audioStoragePath: os.tmpdir(), videoStoragePath: os.tmpdir(),
          useSingleStoragePath: false,
          defaultAudioFormat: "mp3", defaultAudioBitrate: 192, defaultVideoQuality: "1080p",
        }),
      });
      await expect(svc.download(videoId, "audio")).rejects.toThrow(VideoBecameUnavailableError);
      await expect(svc.download(videoId, "audio")).rejects.toMatchObject({ videoId });
    } finally {
      sqlite.close();
    }
  });

  // Regression: a retry resolves to the same templated path as the existing
  // row, and the old-file cleanup used to unlink the file yt-dlp just wrote.
  it("re-download onto the same path keeps the fresh file", async () => {
    const { db, sqlite } = createTestDb();
    try {
      const videoRepo = new VideoRepo(db);
      const mediaRepo = new MediaFileRepo(db);
      const registry = new ProviderRegistry();
      const dir = await tmpdir();
      const finalPath = path.join(dir, "track.mp3");
      await fs.writeFile(finalPath, Buffer.alloc(42));
      registry.register(new FakeAdapter({
        downloadResult: () => ({ filePath: finalPath, format: "mp3", quality: "192kbps", fileSizeBytes: 42, durationSeconds: 1 }),
      }));
      const videoId = videoRepo.upsert({
        provider: "youtube", externalId: "x", title: "t",
        channelTitle: null, durationSeconds: 1, thumbnailUrl: null, availabilityStatus: "available",
      });
      // Existing row points at the same location, spelled with a redundant
      // "." segment (string-concatenated — path.join would normalize it away)
      // so plain string comparison would miss the match.
      mediaRepo.insert({
        videoId, kind: "audio", filePath: dir + path.sep + "." + path.sep + "track.mp3",
        format: "mp3", quality: "192kbps", fileSizeBytes: 41, durationSeconds: 1,
      });
      const svc = new DownloadService({ videoRepo, mediaRepo, registry, settings: () => settingsFor(dir, dir) });
      await svc.download(videoId, "audio");
      const rows = mediaRepo.byVideoId(videoId);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.filePath).toBe(finalPath);
      await expect(fs.access(finalPath)).resolves.toBeUndefined();
    } finally {
      sqlite.close();
    }
  });
});
