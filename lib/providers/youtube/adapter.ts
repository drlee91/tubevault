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
    // FINAL_PATH sentinel + after_move:filepath gives us the post-merge,
    // post-rename, fully-resolved file path on its own line. Parsing the
    // unsuffixed `Destination:` lines instead would pick the intermediate
    // `.f137.mp4` which yt-dlp deletes after merging.
    const FINAL_TAG = "TUBEVAULT_FINAL_PATH:";
    const baseArgs: string[] = [
      "--encoding", "utf-8",
      "--print", `after_move:${FINAL_TAG}%(filepath)s`,
      "-o", outPath,
      // Stale fragments from a prior crashed download (e.g. `.f137.mp4`,
      // `.f251.webm.part`) make yt-dlp issue resume Range requests that the
      // server rejects with HTTP 416. Force a clean re-download and overwrite
      // any leftovers in the output directory.
      "--no-continue",
      "--force-overwrites",
      // Windows Defender briefly holds a handle on freshly-written files,
      // which made the `.part` → final rename fail with WinError 32. Writing
      // directly to the final filename skips that rename. With --no-continue
      // we restart from scratch each run, so losing the `.part` "in progress"
      // marker is fine — the next run overwrites whatever's there.
      "--no-part",
      "--no-warnings",
    ];
    const heightCap = (opts.videoQuality ?? "1080p").replace(/p$/, "");
    // Prefer AAC (m4a) audio when YouTube offers it: native MP4 container
    // playback works in every consumer player, including Windows' built-in
    // "Films & TV". Falls back to bestaudio (often Opus) which is fine in
    // browser-based players but breaks Microsoft's MP4 codec set. No
    // transcode — when AAC is unavailable, we accept the Opus fallback over
    // burning CPU and re-encoding lossy audio.
    const videoFormat = `bv*[height<=${heightCap}]+ba[ext=m4a]/bv*[height<=${heightCap}]+ba/b[height<=${heightCap}]`;
    const args: string[] =
      opts.kind === "audio"
        ? [
            "-f", "bestaudio",
            "-x",
            "--audio-format", opts.audioFormat ?? "mp3",
            "--audio-quality", `${opts.audioBitrate ?? 192}K`,
            ...baseArgs,
            url,
          ]
        : [
            "-f", videoFormat,
            "--merge-output-format", opts.videoContainer ?? "mp4",
            ...baseArgs,
            url,
          ];

    const stdout = await runYtDlp(args, {
      binary: this.opts.binary,
      execFile: this.opts.execFile,
      timeoutMs: this.opts.timeoutMs ?? 5 * 60 * 1000,
    });

    // Prefer the explicit FINAL_TAG line. Fall back to the LAST `Destination:`
    // line (intermediate streams come first; the merged output is last) and
    // finally to the templated path.
    let filePath: string | null = null;
    const tagMatch = stdout.match(new RegExp(`^${FINAL_TAG}(.+)$`, "m"));
    if (tagMatch?.[1]) {
      filePath = tagMatch[1].trim();
    } else {
      const allDest = [...stdout.matchAll(/Destination:\s*(.+)$/gm)];
      const last = allDest.at(-1);
      if (last?.[1]) filePath = last[1].trim();
    }
    if (!filePath) {
      filePath = `${opts.outputDir}/${stem}.${opts.kind === "audio" ? opts.audioFormat ?? "mp3" : opts.videoContainer ?? "mp4"}`;
    }

    const { promises: nodeFs } = await import("node:fs");
    // yt-dlp prints `after_move:filepath` slightly before ffmpeg's final
    // rename is durable on disk, especially on Windows where Defender briefly
    // holds locks on freshly-created files. Retry the stat for ~3s before
    // giving up so transient races don't kill the job.
    let stat = await statWithRetry(nodeFs, filePath, 6, 500);

    // If yt-dlp's `temp.mp4 → final.mp4` rename failed (Defender lock again),
    // the actual completed merge sits next to a stale or partial final file.
    // Detect by size and promote the temp before cleanup.
    const promoted = await promoteTempIfLarger(opts.outputDir, stem, filePath, stat.size);
    if (promoted) stat = await statWithRetry(nodeFs, filePath, 4, 250);

    // Best-effort cleanup of intermediate stream files and ffmpeg's merge
    // temp file that yt-dlp couldn't delete itself.
    await cleanupIntermediates(opts.outputDir, stem, filePath).catch(() => {
      /* never fail the download for a cleanup hiccup */
    });

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

interface StatLike {
  stat(path: string): Promise<{ size: number }>;
}

async function statWithRetry(
  fs: StatLike,
  filePath: string,
  attempts: number,
  delayMs: number,
): Promise<{ size: number }> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fs.stat(filePath);
    } catch (e) {
      lastErr = e;
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

async function promoteTempIfLarger(
  outputDir: string,
  stem: string,
  finalPath: string,
  finalSize: number,
): Promise<boolean> {
  const { promises: fs } = await import("node:fs");
  const path = await import("node:path");
  const ext = path.extname(finalPath);
  const tempPath = path.join(outputDir, `${stem}.temp${ext}`);
  let tempStat: { size: number };
  try {
    tempStat = await fs.stat(tempPath);
  } catch {
    return false;
  }
  if (tempStat.size <= finalSize) return false;
  // Defender may still hold the temp file briefly. Retry the rename a few
  // times so we don't lose the actually-complete merge to a transient lock.
  for (let i = 0; i < 6; i++) {
    try {
      await fs.rm(finalPath, { force: true });
      await fs.rename(tempPath, finalPath);
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  return false;
}

async function cleanupIntermediates(
  outputDir: string,
  stem: string,
  finalPath: string,
): Promise<void> {
  const { promises: fs } = await import("node:fs");
  const path = await import("node:path");
  const finalBase = path.basename(finalPath);
  let entries: string[];
  try {
    entries = await fs.readdir(outputDir);
  } catch {
    return;
  }
  // Match yt-dlp/ffmpeg byproducts: format-id streams (.f136.mp4, .f251.webm),
  // ffmpeg merge temp files (.temp.mp4), aborted .part files. Stem-anchored
  // so we never touch unrelated files in a shared download directory.
  const patterns = [
    new RegExp(`^${escapeRegExp(stem)}\\.f\\d+\\.[a-z0-9]+$`, "i"),
    new RegExp(`^${escapeRegExp(stem)}\\.temp\\.[a-z0-9]+$`, "i"),
    new RegExp(`^${escapeRegExp(stem)}\\..*\\.part$`, "i"),
  ];
  await Promise.all(
    entries
      .filter((name) => name !== finalBase && patterns.some((rx) => rx.test(name)))
      .map((name) => fs.unlink(path.join(outputDir, name)).catch(() => {})),
  );
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
