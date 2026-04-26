import type { JobRow, JobStatus, JobType } from "@/lib/db/repositories/job-repo";
export type { JobRow, JobStatus, JobType };

export interface SyncPlaylistPayload { playlistId: number }
export interface DownloadVideoPayload { videoId: number; kind: "audio" | "video" }
export interface CheckAvailabilityPayload { videoId: number }

export type JobPayload = SyncPlaylistPayload | DownloadVideoPayload | CheckAvailabilityPayload;

export interface JobHandlerResult {
  success: boolean;
  error?: string;
  transient?: boolean;
}

export interface JobHandler {
  handle(job: JobRow): Promise<JobHandlerResult>;
}

export interface WorkerSignaler { signal(): void }
