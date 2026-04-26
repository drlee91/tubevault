import type {
  AvailabilityProbe,
  DownloadOpts,
  DownloadResult,
  MediaProviderAdapter,
  PlaylistMetadata,
  ProviderId,
  VideoMetadata,
} from "../types";

export interface FakeAdapterScript {
  fetchPlaylist?: PlaylistMetadata | (() => PlaylistMetadata | Promise<PlaylistMetadata>);
  fetchVideo?: VideoMetadata | (() => VideoMetadata | Promise<VideoMetadata>);
  downloadResult?:
    | DownloadResult
    | ((id: string, o: DownloadOpts) => DownloadResult | Promise<DownloadResult>);
  availability?: AvailabilityProbe | (() => AvailabilityProbe | Promise<AvailabilityProbe>);
}

export class FakeAdapter implements MediaProviderAdapter {
  readonly provider: ProviderId = "youtube";
  constructor(public script: FakeAdapterScript = {}) {}

  matchesUrl(url: string): boolean {
    return url.includes("youtube") || url.includes("youtu.be");
  }
  parseUrl(url: string) {
    if (url.includes("list=")) {
      return { kind: "playlist" as const, externalId: url.split("list=")[1]!.split("&")[0]! };
    }
    return { kind: "video" as const, externalId: "vid" };
  }
  async fetchPlaylist(): Promise<PlaylistMetadata> {
    const v = this.script.fetchPlaylist;
    if (!v) throw new Error("FakeAdapter: fetchPlaylist not scripted");
    return typeof v === "function" ? await v() : v;
  }
  async fetchVideo(): Promise<VideoMetadata> {
    const v = this.script.fetchVideo;
    if (!v) throw new Error("FakeAdapter: fetchVideo not scripted");
    return typeof v === "function" ? await v() : v;
  }
  async download(id: string, o: DownloadOpts): Promise<DownloadResult> {
    const v = this.script.downloadResult;
    if (!v) throw new Error("FakeAdapter: download not scripted");
    return typeof v === "function" ? await v(id, o) : v;
  }
  async checkAvailability(): Promise<AvailabilityProbe> {
    const v = this.script.availability;
    if (!v) throw new Error("FakeAdapter: availability not scripted");
    return typeof v === "function" ? await v() : v;
  }
}
