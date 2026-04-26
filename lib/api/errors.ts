import { ZodError } from "zod";
import {
  PlaylistAlreadyTrackedError,
  ProviderUnsupportedError,
  UrlNotPlaylistError,
} from "@/lib/services/playlist-service";
import { UrlNotVideoError, VideoAlreadyTrackedError } from "@/lib/services/video-service";
import { PlaylistAlreadySyncingError } from "@/lib/services/sync-service";

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}

export interface ApiErrorResponse {
  status: number;
  body: ApiError;
}

export function mapErrorToResponse(err: unknown): ApiErrorResponse {
  if (err instanceof ZodError) {
    return {
      status: 400,
      body: { error: { code: "VALIDATION_FAILED", message: "Invalid request body", details: err.flatten() } },
    };
  }
  if (err instanceof ProviderUnsupportedError) {
    return { status: 400, body: { error: { code: "PROVIDER_UNSUPPORTED", message: err.message } } };
  }
  if (err instanceof UrlNotPlaylistError) {
    return { status: 400, body: { error: { code: "URL_NOT_PLAYLIST", message: err.message } } };
  }
  if (err instanceof UrlNotVideoError) {
    return { status: 400, body: { error: { code: "URL_NOT_VIDEO", message: err.message } } };
  }
  if (err instanceof PlaylistAlreadyTrackedError) {
    return {
      status: 409,
      body: { error: { code: "PLAYLIST_ALREADY_TRACKED", message: err.message, details: { playlistId: err.playlistId } } },
    };
  }
  if (err instanceof VideoAlreadyTrackedError) {
    return {
      status: 409,
      body: { error: { code: "VIDEO_ALREADY_TRACKED", message: err.message, details: { videoId: err.videoId } } },
    };
  }
  if (err instanceof PlaylistAlreadySyncingError) {
    return { status: 409, body: { error: { code: "SYNC_ALREADY_RUNNING", message: err.message } } };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { status: 500, body: { error: { code: "INTERNAL", message } } };
}
