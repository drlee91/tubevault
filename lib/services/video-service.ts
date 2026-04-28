import type { VideoRepo, VideoRow } from "@/lib/db/repositories/video-repo";
import type { JobQueue } from "@/lib/jobs/queue";
import type { ProviderRegistry } from "@/lib/providers/registry";
import { ProviderUnsupportedError } from "./playlist-service";

export class UrlNotVideoError extends Error {
  constructor(public readonly url: string) {
    super(`url is not a video: ${url}`);
    this.name = "UrlNotVideoError";
  }
}
export class VideoAlreadyTrackedError extends Error {
  constructor(public readonly videoId: number) {
    super(`video already tracked: ${videoId}`);
    this.name = "VideoAlreadyTrackedError";
  }
}
export class VideoNotFoundError extends Error {
  constructor(public readonly videoId: number) {
    super(`video not found: ${videoId}`);
    this.name = "VideoNotFoundError";
  }
}
export class VideoNotAvailableError extends Error {
  constructor(public readonly videoId: number) {
    super(`video not available: ${videoId}`);
    this.name = "VideoNotAvailableError";
  }
}

export interface AddStandaloneInput {
  url: string;
  format: "audio" | "video";
}

export interface VideoServiceDeps {
  videoRepo: VideoRepo;
  queue: JobQueue;
  registry: ProviderRegistry;
}

export class VideoService {
  constructor(private readonly d: VideoServiceDeps) {}

  async addStandalone(input: AddStandaloneInput): Promise<{ video: VideoRow; downloadJobId: number }> {
    const adapter = this.d.registry.findByUrl(input.url);
    if (!adapter) throw new ProviderUnsupportedError(input.url);
    const parsed = adapter.parseUrl(input.url);
    if (!parsed || parsed.kind !== "video") throw new UrlNotVideoError(input.url);
    const meta = await adapter.fetchVideo(input.url);
    const existing = this.d.videoRepo.byProviderExternalId(adapter.provider, meta.externalId);
    if (existing) throw new VideoAlreadyTrackedError(existing.id);
    const id = this.d.videoRepo.upsert({
      provider: adapter.provider,
      externalId: meta.externalId,
      title: meta.title,
      channelTitle: meta.channelTitle,
      channelId: meta.channelId,
      durationSeconds: meta.durationSeconds,
      thumbnailUrl: meta.thumbnailUrl,
      availabilityStatus: meta.inferredStatus,
      availabilityReason: meta.availabilityReason,
    });
    const video = this.d.videoRepo.byId(id)!;
    const downloadJobId = await this.d.queue.enqueue(
      "download_video",
      { videoId: id, kind: input.format },
      { priority: 5 },
    );
    return { video, downloadJobId };
  }

  byId(id: number): VideoRow | null {
    return this.d.videoRepo.byId(id);
  }

  listStandalone(): VideoRow[] {
    return this.d.videoRepo.listStandalone();
  }

  async forceDownload(videoId: number, kind: "audio" | "video"): Promise<{ jobId: number }> {
    const video = this.d.videoRepo.byId(videoId);
    if (!video) throw new VideoNotFoundError(videoId);
    if (video.availabilityStatus !== "available") throw new VideoNotAvailableError(videoId);
    const jobId = await this.d.queue.enqueue("download_video", { videoId, kind }, { priority: 15 });
    return { jobId };
  }

  async enqueueRefresh(videoId: number): Promise<{ jobId: number }> {
    const video = this.d.videoRepo.byId(videoId);
    if (!video) throw new VideoNotFoundError(videoId);
    const jobId = await this.d.queue.enqueue("check_availability", { videoId }, { priority: 10 });
    return { jobId };
  }
}
