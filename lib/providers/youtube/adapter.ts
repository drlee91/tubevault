import type {
  AvailabilityProbe,
  DownloadOpts,
  DownloadResult,
  MediaProviderAdapter,
  PlaylistMetadata,
  ProviderId,
  VideoMetadata,
  VideoStub,
} from "../types";
import { matchesYouTubeUrl, parseYouTubeUrl } from "./url-parser";
import { mapYouTubeAvailability } from "./status-mapper";
import { runYtDlp, type ExecFileLike } from "./yt-dlp";

export interface YouTubeAdapterOptions {
  binary: string;
  execFile?: ExecFileLike;
  timeoutMs?: number;
}

interface FlatPlaylistEntry {
  id: string;
  title: string;
  uploader: string | null;
  duration: number | null;
  thumbnails: Array<{ url: string }>;
  availability: string | null;
}

interface FlatPlaylistJson {
  id: string;
  title: string;
  uploader: string | null;
  webpage_url: string;
  entries: FlatPlaylistEntry[];
}

export class YouTubeAdapter implements MediaProviderAdapter {
  readonly provider: ProviderId = "youtube";
  constructor(private opts: YouTubeAdapterOptions) {}

  matchesUrl(url: string): boolean {
    return matchesYouTubeUrl(url);
  }
  parseUrl(url: string) {
    return parseYouTubeUrl(url);
  }

  async fetchPlaylist(url: string): Promise<PlaylistMetadata> {
    const stdout = await runYtDlp(
      ["--flat-playlist", "--dump-single-json", "--no-warnings", url],
      { binary: this.opts.binary, execFile: this.opts.execFile, timeoutMs: this.opts.timeoutMs },
    );
    const json = JSON.parse(stdout) as FlatPlaylistJson;
    const items: VideoStub[] = json.entries.map((e) => ({
      externalId: e.id,
      title: e.title,
      channelTitle: e.uploader,
      durationSeconds: e.duration,
      thumbnailUrl: e.thumbnails[0]?.url ?? null,
      inferredStatus: mapYouTubeAvailability(e.availability, e.title),
    }));
    return {
      externalId: json.id,
      title: json.title,
      channelTitle: json.uploader,
      url: json.webpage_url,
      items,
    };
  }

  async fetchVideo(_url: string): Promise<VideoMetadata> {
    throw new Error("fetchVideo not yet implemented");
  }
  async download(_externalId: string, _opts: DownloadOpts): Promise<DownloadResult> {
    throw new Error("download not yet implemented");
  }
  async checkAvailability(_externalId: string): Promise<AvailabilityProbe> {
    throw new Error("checkAvailability not yet implemented");
  }
}
