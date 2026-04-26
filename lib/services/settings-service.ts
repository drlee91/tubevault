import { z } from "zod";
import { homedir } from "node:os";
import path from "node:path";
import type { SettingsRepository } from "@/lib/db/repositories/settings-repo";

// ---------- value schemas ----------
const audioFormatSchema = z.enum(["mp3", "m4a", "opus", "flac", "best"]);
export type AudioFormat = z.infer<typeof audioFormatSchema>;

const videoQualitySchema = z.enum(["480p", "720p", "1080p", "1440p", "2160p", "best"]);
export type VideoQuality = z.infer<typeof videoQualitySchema>;

const audioBitrateSchema = z.enum(["128", "192", "256", "320", "vbr"]);
export type AudioBitrate = z.infer<typeof audioBitrateSchema>;

const themeSchema = z.enum(["light", "dark", "system"]);
export type Theme = z.infer<typeof themeSchema>;

const nonEmptyString = z.string().min(1);
const concurrencySchema = z.number().int().min(1).max(10);

// ---------- keys ----------
const KEYS = {
  audioStoragePath: "audio_storage_path",
  videoStoragePath: "video_storage_path",
  useSingleStoragePath: "use_single_storage_path",
  defaultAudioFormat: "default_audio_format",
  defaultAudioBitrate: "default_audio_bitrate",
  defaultVideoQuality: "default_video_quality",
  embedThumbnails: "embed_thumbnails",
  globalSyncCron: "global_sync_cron",
  syncOnStartup: "sync_on_startup",
  concurrency: "concurrency_max",
  theme: "theme",
  ytdlpPath: "ytdlp_path",
  ffmpegPath: "ffmpeg_path",
} as const;

export class SettingsService {
  constructor(private readonly repo: SettingsRepository) {}

  // ---------- storage ----------
  getAudioStoragePath(): string {
    return (
      this.repo.get<string>(KEYS.audioStoragePath) ?? path.join(homedir(), "Music", "TubeVault")
    );
  }
  setAudioStoragePath(value: string): void {
    this.repo.set(KEYS.audioStoragePath, nonEmptyString.parse(value));
  }

  getVideoStoragePath(): string {
    return (
      this.repo.get<string>(KEYS.videoStoragePath) ?? path.join(homedir(), "Videos", "TubeVault")
    );
  }
  setVideoStoragePath(value: string): void {
    this.repo.set(KEYS.videoStoragePath, nonEmptyString.parse(value));
  }

  getUseSingleStoragePath(): boolean {
    return this.repo.get<boolean>(KEYS.useSingleStoragePath) ?? false;
  }
  setUseSingleStoragePath(value: boolean): void {
    this.repo.set(KEYS.useSingleStoragePath, z.boolean().parse(value));
  }

  // ---------- formats ----------
  getDefaultAudioFormat(): AudioFormat {
    return this.repo.get<AudioFormat>(KEYS.defaultAudioFormat) ?? "mp3";
  }
  setDefaultAudioFormat(value: AudioFormat): void {
    this.repo.set(KEYS.defaultAudioFormat, audioFormatSchema.parse(value));
  }

  getDefaultAudioBitrate(): AudioBitrate {
    return this.repo.get<AudioBitrate>(KEYS.defaultAudioBitrate) ?? "192";
  }
  setDefaultAudioBitrate(value: AudioBitrate): void {
    this.repo.set(KEYS.defaultAudioBitrate, audioBitrateSchema.parse(value));
  }

  getDefaultVideoQuality(): VideoQuality {
    return this.repo.get<VideoQuality>(KEYS.defaultVideoQuality) ?? "1080p";
  }
  setDefaultVideoQuality(value: VideoQuality): void {
    this.repo.set(KEYS.defaultVideoQuality, videoQualitySchema.parse(value));
  }

  getEmbedThumbnails(): boolean {
    return this.repo.get<boolean>(KEYS.embedThumbnails) ?? true;
  }
  setEmbedThumbnails(value: boolean): void {
    this.repo.set(KEYS.embedThumbnails, z.boolean().parse(value));
  }

  // ---------- sync ----------
  getGlobalSyncCron(): string | null {
    return this.repo.get<string>(KEYS.globalSyncCron);
  }
  setGlobalSyncCron(value: string | null): void {
    if (value === null) this.repo.delete(KEYS.globalSyncCron);
    else this.repo.set(KEYS.globalSyncCron, nonEmptyString.parse(value));
  }

  getSyncOnStartup(): boolean {
    return this.repo.get<boolean>(KEYS.syncOnStartup) ?? false;
  }
  setSyncOnStartup(value: boolean): void {
    this.repo.set(KEYS.syncOnStartup, z.boolean().parse(value));
  }

  getConcurrency(): number {
    return this.repo.get<number>(KEYS.concurrency) ?? 3;
  }
  setConcurrency(value: number): void {
    this.repo.set(KEYS.concurrency, concurrencySchema.parse(value));
  }

  // ---------- ui ----------
  getTheme(): Theme {
    return this.repo.get<Theme>(KEYS.theme) ?? "system";
  }
  setTheme(value: Theme): void {
    this.repo.set(KEYS.theme, themeSchema.parse(value));
  }

  // ---------- paths to external tools ----------
  getYtdlpPath(): string | null {
    return this.repo.get<string>(KEYS.ytdlpPath);
  }
  setYtdlpPath(value: string | null): void {
    if (value === null) this.repo.delete(KEYS.ytdlpPath);
    else this.repo.set(KEYS.ytdlpPath, nonEmptyString.parse(value));
  }

  getFfmpegPath(): string | null {
    return this.repo.get<string>(KEYS.ffmpegPath);
  }
  setFfmpegPath(value: string | null): void {
    if (value === null) this.repo.delete(KEYS.ffmpegPath);
    else this.repo.set(KEYS.ffmpegPath, nonEmptyString.parse(value));
  }
}
