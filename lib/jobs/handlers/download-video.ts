import type { JobHandler, JobHandlerResult, JobRow, DownloadVideoPayload } from "../types";
import { VideoBecameUnavailableError, type DownloadService } from "@/lib/services/download-service";
import type { VideoRepo } from "@/lib/db/repositories/video-repo";

export class DownloadVideoHandler implements JobHandler {
  constructor(
    private readonly dl: DownloadService,
    private readonly videoRepo: VideoRepo,
  ) {}

  async handle(job: JobRow): Promise<JobHandlerResult> {
    const payload = job.payload as unknown as DownloadVideoPayload;
    try {
      await this.dl.download(payload.videoId, payload.kind);
      // A finished download is proof the video is fetchable — lift "unknown"
      // (flat-playlist extraction often reports no availability) to
      // "available" so status filters and counts reflect reality. More
      // specific states (age_restricted, region_blocked, …) are kept.
      if (this.videoRepo.byId(payload.videoId)?.availabilityStatus === "unknown") {
        this.videoRepo.setAvailability(payload.videoId, "available", null);
      }
      return { success: true };
    } catch (err) {
      if (err instanceof VideoBecameUnavailableError) {
        this.videoRepo.setAvailability(payload.videoId, "removed", err.reason);
        return { success: false, error: err.message, transient: false };
      }
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        transient: true,
      };
    }
  }
}
