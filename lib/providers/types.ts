import type { AvailabilityStatus } from "@/lib/db/schema";

export type ProviderId = "youtube";

/**
 * Thrown by a provider adapter's `download()` when the remote resource is
 * definitively gone (deleted, private, terminated account, etc.).
 * The DownloadService maps this to VideoBecameUnavailableError so the job
 * handler can mark the video removed without retrying.
 */
export class MediaUnavailableError extends Error {
  constructor(
    public readonly externalId: string,
    public readonly reason: string,
  ) {
    super(`media ${externalId} unavailable: ${reason}`);
    this.name = "MediaUnavailableError";
  }
}

export { AVAILABILITY_STATUSES } from "@/lib/db/schema";
export type { AvailabilityStatus } from "@/lib/db/schema";

export interface VideoStub {
  externalId: string;
  title: string;
  channelTitle: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  inferredStatus: AvailabilityStatus;
}

export interface PlaylistMetadata {
  externalId: string;
  title: string;
  channelTitle: string | null;
  url: string;
  items: VideoStub[];
}

export interface VideoMetadata extends VideoStub {
  channelId: string | null;
  description: string | null;
  uploadDate: string | null;
  availabilityReason: string | null;
}

export interface DownloadOpts {
  kind: "audio" | "video";
  audioFormat?: "mp3" | "m4a" | "opus" | "flac";
  audioBitrate?: number;
  videoQuality?: "720p" | "1080p" | "1440p" | "2160p" | "best";
  videoContainer?: "mp4" | "webm" | "mkv";
  outputDir: string;
  filenameStem: string;
  durationSeconds?: number | null;
  /** Browser whose cookies yt-dlp should use (age-restricted videos). */
  cookiesFromBrowser?: string | null;
}

export interface DownloadResult {
  filePath: string;
  format: string;
  quality: string;
  fileSizeBytes: number;
  durationSeconds: number;
}

export interface AvailabilityProbe {
  status: AvailabilityStatus;
  reason: string | null;
}

export interface FetchPlaylistOpts {
  /** Browser whose cookies yt-dlp should use (private playlists need a signed-in session). */
  cookiesFromBrowser?: string | null;
}

export interface MediaProviderAdapter {
  readonly provider: ProviderId;
  matchesUrl(url: string): boolean;
  parseUrl(url: string): { kind: "playlist" | "video"; externalId: string } | null;
  fetchPlaylist(url: string, opts?: FetchPlaylistOpts): Promise<PlaylistMetadata>;
  fetchVideo(url: string): Promise<VideoMetadata>;
  download(externalId: string, opts: DownloadOpts): Promise<DownloadResult>;
  checkAvailability(externalId: string): Promise<AvailabilityProbe>;
}
