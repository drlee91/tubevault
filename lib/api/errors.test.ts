import { describe, it, expect } from "vitest";
import { type ZodError, z } from "zod";
import {
  PlaylistAlreadyTrackedError,
  ProviderUnsupportedError,
  UrlNotPlaylistError,
} from "@/lib/services/playlist-service";
import { PlaylistAlreadySyncingError } from "@/lib/services/sync-service";
import { mapErrorToResponse } from "./errors";

describe("mapErrorToResponse", () => {
  it("maps ZodError to 400 VALIDATION_FAILED", () => {
    const err = (() => {
      try { z.object({ x: z.number() }).parse({ x: "no" }); return null; }
      catch (e) { return e as ZodError; }
    })()!;
    const r = mapErrorToResponse(err);
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe("VALIDATION_FAILED");
  });
  it("maps domain errors to specific codes", () => {
    expect(mapErrorToResponse(new ProviderUnsupportedError("u")).status).toBe(400);
    expect(mapErrorToResponse(new UrlNotPlaylistError("u")).status).toBe(400);
    expect(mapErrorToResponse(new PlaylistAlreadyTrackedError(1)).status).toBe(409);
    expect(mapErrorToResponse(new PlaylistAlreadySyncingError(1)).status).toBe(409);
  });
  it("falls back to 500 for unknown errors", () => {
    expect(mapErrorToResponse(new Error("boom")).status).toBe(500);
  });
});
