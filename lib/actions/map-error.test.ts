import { describe, it, expect } from "vitest";
import { mapServiceError } from "./map-error";
import { PlaylistAlreadyTrackedError, ProviderUnsupportedError, UrlNotPlaylistError } from "@/lib/services/playlist-service";
import { VideoNotAvailableError, VideoNotFoundError } from "@/lib/services/video-service";
import { JobNotFoundError, NotRetryableError } from "@/lib/services/job-service";

describe("mapServiceError", () => {
  it("maps PlaylistAlreadyTrackedError", () => {
    const r = mapServiceError(new PlaylistAlreadyTrackedError(42));
    expect(r.code).toBe("PLAYLIST_ALREADY_TRACKED");
  });
  it("maps UrlNotPlaylistError", () => {
    expect(mapServiceError(new UrlNotPlaylistError("x")).code).toBe("URL_NOT_PLAYLIST");
  });
  it("maps ProviderUnsupportedError", () => {
    expect(mapServiceError(new ProviderUnsupportedError("x")).code).toBe("PROVIDER_UNSUPPORTED");
  });
  it("maps VideoNotAvailableError", () => {
    expect(mapServiceError(new VideoNotAvailableError(1)).code).toBe("VIDEO_NOT_AVAILABLE");
  });
  it("maps VideoNotFoundError", () => {
    expect(mapServiceError(new VideoNotFoundError(1)).code).toBe("VIDEO_NOT_FOUND");
  });
  it("maps JobNotFoundError", () => {
    expect(mapServiceError(new JobNotFoundError(1)).code).toBe("JOB_NOT_FOUND");
  });
  it("maps NotRetryableError", () => {
    expect(mapServiceError(new NotRetryableError(1, "queued")).code).toBe("NOT_RETRYABLE");
  });
  it("falls back to INTERNAL", () => {
    expect(mapServiceError(new Error("boom")).code).toBe("INTERNAL");
  });
});
