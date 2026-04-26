import { describe, it, expect } from "vitest";
import { mapYouTubeAvailability } from "./status-mapper";

describe("mapYouTubeAvailability", () => {
  it("maps public/unlisted to available", () => {
    expect(mapYouTubeAvailability("public")).toBe("available");
    expect(mapYouTubeAvailability("unlisted")).toBe("available");
  });
  it("maps private to private", () => {
    expect(mapYouTubeAvailability("private")).toBe("private");
  });
  it("maps auth-flavoured statuses to auth_required", () => {
    expect(mapYouTubeAvailability("needs_auth")).toBe("auth_required");
    expect(mapYouTubeAvailability("subscriber_only")).toBe("auth_required");
    expect(mapYouTubeAvailability("premium_only")).toBe("auth_required");
  });
  it("infers removed from [Deleted video] placeholder title", () => {
    expect(mapYouTubeAvailability(null, "[Deleted video]")).toBe("removed");
  });
  it("infers private from [Private video] placeholder title", () => {
    expect(mapYouTubeAvailability(null, "[Private video]")).toBe("private");
  });
  it("falls back to unknown for unrecognised input", () => {
    expect(mapYouTubeAvailability("something_new")).toBe("unknown");
    expect(mapYouTubeAvailability(null)).toBe("unknown");
  });
});
