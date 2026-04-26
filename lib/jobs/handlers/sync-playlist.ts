import type { JobHandler, JobHandlerResult, JobRow, SyncPlaylistPayload } from "../types";
import { PlaylistAlreadySyncingError, type SyncService } from "@/lib/services/sync-service";

export class SyncPlaylistHandler implements JobHandler {
  constructor(private readonly sync: SyncService) {}

  async handle(job: JobRow): Promise<JobHandlerResult> {
    const payload = job.payload as unknown as SyncPlaylistPayload;
    try {
      await this.sync.sync(payload.playlistId, "manual");
      return { success: true };
    } catch (err) {
      if (err instanceof PlaylistAlreadySyncingError) {
        return { success: false, error: err.message, transient: true };
      }
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        transient: true,
      };
    }
  }
}
