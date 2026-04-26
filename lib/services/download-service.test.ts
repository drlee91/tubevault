import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createTestDb } from "@/lib/db/__tests__/test-db";
import { VideoRepo } from "@/lib/db/repositories/video-repo";
import { MediaFileRepo } from "@/lib/db/repositories/media-file-repo";
import { ProviderRegistry } from "@/lib/providers/registry";
import { FakeAdapter } from "@/lib/providers/__tests__/fake-adapter";
import { DownloadService, type DownloadServiceSettings } from "./download-service";

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
});
