import { promises as fs } from "node:fs";
import path from "node:path";
import type { VideoRepo } from "@/lib/db/repositories/video-repo";
import type { MediaFileRepo, MediaFileRow } from "@/lib/db/repositories/media-file-repo";
import type { ProviderRegistry } from "@/lib/providers/registry";
import type { ProviderId } from "@/lib/providers/types";
import { MediaUnavailableError } from "@/lib/providers/types";
import { sanitizeFilename } from "@/lib/utils/sanitize-filename";

export interface DownloadServiceSettings {
  audioStoragePath: string;
  videoStoragePath: string;
  useSingleStoragePath: boolean;
  defaultAudioFormat: "mp3" | "m4a" | "opus" | "flac";
  defaultAudioBitrate: number;
  defaultVideoQuality: "720p" | "1080p" | "1440p" | "2160p" | "best";
}

export interface DownloadServiceDeps {
  videoRepo: VideoRepo;
  mediaRepo: MediaFileRepo;
  registry: ProviderRegistry;
  settings: () => DownloadServiceSettings;
}

export class VideoBecameUnavailableError extends Error {
  constructor(public readonly videoId: number, public readonly reason: string) {
    super(`video ${videoId} unavailable: ${reason}`);
    this.name = "VideoBecameUnavailableError";
  }
}

export class DownloadService {
  constructor(private readonly d: DownloadServiceDeps) {}

  async download(videoId: number, kind: "audio" | "video"): Promise<MediaFileRow> {
    const video = this.d.videoRepo.byId(videoId);
    if (!video) throw new Error(`video ${videoId} not found`);
    const adapter = this.d.registry.findById(video.provider as ProviderId);
    if (!adapter) throw new Error(`no adapter for provider ${video.provider}`);
    const settings = this.d.settings();
    const base = this.resolveBase(kind, settings);
    const stem = sanitizeFilename(`${video.title}-${video.externalId}`);

    await fs.mkdir(base, { recursive: true });
    let result;
    try {
      result = await adapter.download(video.externalId, {
        kind,
        audioFormat: settings.defaultAudioFormat,
        audioBitrate: settings.defaultAudioBitrate,
        videoQuality: settings.defaultVideoQuality,
        videoContainer: "mp4",
        outputDir: base,
        filenameStem: stem,
        durationSeconds: video.durationSeconds,
      });
    } catch (e) {
      if (e instanceof MediaUnavailableError) {
        throw new VideoBecameUnavailableError(videoId, e.reason);
      }
      throw e;
    }

    const existing = this.d.mediaRepo.find(videoId, kind);
    if (existing) {
      // Re-downloads resolve to the same templated path (outputDir + stem),
      // so the "old" file IS the file yt-dlp just wrote — unlinking it here
      // used to delete the fresh download right after a successful retry.
      // Only remove the old file when it actually lives somewhere else
      // (storage path or filename settings changed between downloads).
      if (!isSameFile(existing.filePath, result.filePath)) {
        await fs.unlink(existing.filePath).catch(() => {
          /* best effort — old file may be gone or locked */
        });
      }
      this.d.mediaRepo.delete(existing.id);
    }
    this.d.mediaRepo.insert({
      videoId,
      kind,
      filePath: result.filePath,
      format: result.format,
      quality: result.quality,
      fileSizeBytes: result.fileSizeBytes,
      durationSeconds: result.durationSeconds || video.durationSeconds || 0,
    });
    return this.d.mediaRepo.find(videoId, kind)!;
  }

  private resolveBase(kind: "audio" | "video", s: DownloadServiceSettings): string {
    if (s.useSingleStoragePath) return s.audioStoragePath;
    return kind === "audio" ? s.audioStoragePath : s.videoStoragePath;
  }
}

function isSameFile(a: string, b: string): boolean {
  const ra = path.resolve(a);
  const rb = path.resolve(b);
  if (ra === rb) return true;
  // Windows paths are case-insensitive; relative vs. absolute spellings of
  // the same location must compare equal too (resolve handles separators).
  return process.platform === "win32" && ra.toLowerCase() === rb.toLowerCase();
}
