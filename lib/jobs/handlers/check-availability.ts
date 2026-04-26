import type { JobHandler, JobHandlerResult, JobRow, CheckAvailabilityPayload } from "../types";
import type { ProviderRegistry } from "@/lib/providers/registry";
import type { ProviderId } from "@/lib/providers/types";
import type { VideoRepo } from "@/lib/db/repositories/video-repo";

export class CheckAvailabilityHandler implements JobHandler {
  constructor(
    private readonly registry: ProviderRegistry,
    private readonly videoRepo: VideoRepo,
  ) {}

  async handle(job: JobRow): Promise<JobHandlerResult> {
    const payload = job.payload as unknown as CheckAvailabilityPayload;
    try {
      const video = this.videoRepo.byId(payload.videoId);
      if (!video) {
        return { success: false, error: `video ${payload.videoId} not found`, transient: false };
      }
      const adapter = this.registry.findById(video.provider as ProviderId);
      if (!adapter) {
        return { success: false, error: `no adapter for ${video.provider}`, transient: false };
      }
      const probe = await adapter.checkAvailability(video.externalId);
      this.videoRepo.setAvailability(payload.videoId, probe.status, probe.reason);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        transient: true,
      };
    }
  }
}
