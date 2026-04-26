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

interface VideoJson {
  id: string;
  title: string;
  uploader: string | null;
  channel_id: string | null;
  duration: number | null;
  thumbnail: string | null;
  availability: string | null;
  description: string | null;
  upload_date: string | null;
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

  async fetchVideo(url: string): Promise<VideoMetadata> {
    const stdout = await runYtDlp(
      ["--dump-json", "--no-warnings", "--skip-download", url],
      { binary: this.opts.binary, execFile: this.opts.execFile, timeoutMs: this.opts.timeoutMs },
    );
    const j = JSON.parse(stdout) as VideoJson;
    return {
      externalId: j.id,
      title: j.title,
      channelTitle: j.uploader,
      channelId: j.channel_id,
      durationSeconds: j.duration,
      thumbnailUrl: j.thumbnail,
      inferredStatus: mapYouTubeAvailability(j.availability, j.title),
      description: j.description,
      uploadDate: j.upload_date,
      availabilityReason: null,
    };
  }
  async download(externalId: string, opts: DownloadOpts): Promise<DownloadResult> {
    const url = `https://www.youtube.com/watch?v=${externalId}`;
    const stem = opts.filenameStem;
    const outPath = `${opts.outputDir}/${stem}.%(ext)s`;
    const args: string[] =
      opts.kind === "audio"
        ? [
            "-f", "bestaudio",
            "-x",
            "--audio-format", opts.audioFormat ?? "mp3",
            "--audio-quality", `${opts.audioBitrate ?? 192}K`,
            "-o", outPath,
            "--no-warnings",
            url,
          ]
        : [
            "-f", `bestvideo[height<=${(opts.videoQuality ?? "1080p").replace(/p$/, "")}]+bestaudio/best`,
            "--merge-output-format", opts.videoContainer ?? "mp4",
            "-o", outPath,
            "--no-warnings",
            url,
          ];

    const stdout = await runYtDlp(args, {
      binary: this.opts.binary,
      execFile: this.opts.execFile,
      timeoutMs: this.opts.timeoutMs ?? 5 * 60 * 1000,
    });

    // yt-dlp prints destination paths via "[ffmpeg] Destination: …" or "[download] Destination: …"
    const match = stdout.match(/Destination:\s*(.+)$/m);
    const filePath = match?.[1]?.trim() ?? `${opts.outputDir}/${stem}.${opts.kind === "audio" ? opts.audioFormat ?? "mp3" : opts.videoContainer ?? "mp4"}`;

    const { promises: nodeFs } = await import("node:fs");
    const stat = await nodeFs.stat(filePath);

    return {
      filePath,
      format: opts.kind === "audio" ? opts.audioFormat ?? "mp3" : opts.videoContainer ?? "mp4",
      quality:
        opts.kind === "audio"
          ? `${opts.audioBitrate ?? 192}kbps`
          : opts.videoQuality ?? "1080p",
      fileSizeBytes: stat.size,
      durationSeconds: 0,
    };
  }
  async checkAvailability(externalId: string): Promise<AvailabilityProbe> {
    const url = `https://www.youtube.com/watch?v=${externalId}`;
    try {
      const stdout = await runYtDlp(
        ["--skip-download", "--no-warnings", "--print", "%(availability)s|%(title)s", url],
        { binary: this.opts.binary, execFile: this.opts.execFile, timeoutMs: this.opts.timeoutMs },
      );
      const [rawStatus, ...rest] = stdout.trim().split("|");
      const title = rest.join("|");
      return { status: mapYouTubeAvailability(rawStatus ?? null, title), reason: title || null };
    } catch (e) {
      const stderr = (e as { stderr?: string }).stderr ?? "";
      if (/Video unavailable|This video has been removed/i.test(stderr)) {
        return { status: "removed", reason: stderr.trim() || null };
      }
      if (/Private video/i.test(stderr)) return { status: "private", reason: stderr.trim() || null };
      if (/Sign in to confirm your age/i.test(stderr)) return { status: "age_restricted", reason: stderr.trim() || null };
      if (/not available in your country/i.test(stderr)) return { status: "region_blocked", reason: stderr.trim() || null };
      return { status: "unknown", reason: stderr.trim() || null };
    }
  }
}
