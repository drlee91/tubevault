import { describe, it, expect } from "vitest";
import { matchesYouTubeUrl, parseYouTubeUrl } from "./url-parser";

describe("matchesYouTubeUrl", () => {
  it("matches youtube.com hosts", () => {
    expect(matchesYouTubeUrl("https://www.youtube.com/watch?v=abc")).toBe(true);
    expect(matchesYouTubeUrl("https://youtube.com/playlist?list=PL1")).toBe(true);
    expect(matchesYouTubeUrl("https://m.youtube.com/watch?v=abc")).toBe(true);
  });
  it("matches youtu.be short links", () => {
    expect(matchesYouTubeUrl("https://youtu.be/abc")).toBe(true);
  });
  it("rejects other hosts", () => {
    expect(matchesYouTubeUrl("https://soundcloud.com/track")).toBe(false);
    expect(matchesYouTubeUrl("not a url")).toBe(false);
  });
});

describe("parseYouTubeUrl", () => {
  it("extracts playlist id from playlist URL", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/playlist?list=PLabc")).toEqual({
      kind: "playlist",
      externalId: "PLabc",
    });
  });
  it("prefers playlist over video when both present", () => {
    expect(
      parseYouTubeUrl("https://www.youtube.com/watch?v=vid1&list=PLabc"),
    ).toEqual({ kind: "playlist", externalId: "PLabc" });
  });
  it("extracts video id from /watch URL", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      kind: "video",
      externalId: "dQw4w9WgXcQ",
    });
  });
  it("extracts video id from youtu.be short link", () => {
    expect(parseYouTubeUrl("https://youtu.be/dQw4w9WgXcQ")).toEqual({
      kind: "video",
      externalId: "dQw4w9WgXcQ",
    });
  });
  it("extracts video id from /shorts/", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/shorts/abc123")).toEqual({
      kind: "video",
      externalId: "abc123",
    });
  });
  it("returns null for unmatched URL shapes", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/")).toBeNull();
    expect(parseYouTubeUrl("not a url")).toBeNull();
  });
});
