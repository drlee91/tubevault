import type { ActionError } from "./types";
import {
  PlaylistAlreadyTrackedError,
  ProviderUnsupportedError,
  UrlNotPlaylistError,
} from "@/lib/services/playlist-service";
import {
  UrlNotVideoError,
  VideoAlreadyTrackedError,
  VideoNotAvailableError,
  VideoNotFoundError,
} from "@/lib/services/video-service";
import {
  JobNotFoundError,
  NotRetryableError,
} from "@/lib/services/job-service";

export function mapServiceError(err: unknown): ActionError {
  if (err instanceof PlaylistAlreadyTrackedError)
    return { code: "PLAYLIST_ALREADY_TRACKED", message: err.message };
  if (err instanceof UrlNotPlaylistError)
    return { code: "URL_NOT_PLAYLIST", message: "URL is not a playlist" };
  if (err instanceof ProviderUnsupportedError)
    return { code: "PROVIDER_UNSUPPORTED", message: "Provider not supported" };
  if (err instanceof UrlNotVideoError)
    return { code: "URL_NOT_VIDEO", message: "URL is not a video" };
  if (err instanceof VideoAlreadyTrackedError)
    return { code: "VIDEO_ALREADY_TRACKED", message: "Video is already tracked" };
  if (err instanceof VideoNotAvailableError)
    return { code: "VIDEO_NOT_AVAILABLE", message: "Video is not available" };
  if (err instanceof VideoNotFoundError)
    return { code: "VIDEO_NOT_FOUND", message: "Video not found" };
  if (err instanceof JobNotFoundError)
    return { code: "JOB_NOT_FOUND", message: "Job not found" };
  if (err instanceof NotRetryableError)
    return { code: "NOT_RETRYABLE", message: "Job is not retryable" };
  return { code: "INTERNAL", message: err instanceof Error ? err.message : "Internal error" };
}
