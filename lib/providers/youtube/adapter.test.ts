import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { YouTubeAdapter } from "./adapter";
import type { ExecFileLike } from "./yt-dlp";

async function fixture(name: string): Promise<string> {
  return fs.readFile(path.resolve("tests/fixtures/yt-dlp", `${name}.json`), "utf8");
}

function fakeExecReturning(stdout: string): ExecFileLike {
  return (_f, _a, _o, cb) => cb(null, stdout, "");
}

describe("YouTubeAdapter — URL handling", () => {
  const a = new YouTubeAdapter({ binary: "yt-dlp", execFile: fakeExecReturning("") });
  it("matchesUrl recognises YouTube hosts", () => {
    expect(a.matchesUrl("https://youtu.be/x")).toBe(true);
    expect(a.matchesUrl("https://soundcloud.com/x")).toBe(false);
  });
  it("parseUrl extracts playlist or video id", () => {
    expect(a.parseUrl("https://www.youtube.com/playlist?list=PL1")).toEqual({
      kind: "playlist",
      externalId: "PL1",
    });
  });
});

describe("YouTubeAdapter.fetchPlaylist", () => {
  it("parses flat-playlist JSON into PlaylistMetadata + VideoStub[]", async () => {
    const stdout = await fixture("flat-playlist-music");
    const adapter = new YouTubeAdapter({ binary: "yt-dlp", execFile: fakeExecReturning(stdout) });
    const meta = await adapter.fetchPlaylist("https://www.youtube.com/playlist?list=PLBCF2DAC6FFB574DE");
    expect(meta.externalId).toBe("PLBCF2DAC6FFB574DE");
    expect(meta.title).toBe("Sample Music Playlist");
    expect(meta.items).toHaveLength(2);
    expect(meta.items[0]).toMatchObject({
      externalId: "abc111",
      title: "Track One",
      channelTitle: "Channel A",
      durationSeconds: 215,
      inferredStatus: "available",
    });
  });

  it("infers removed/private from placeholder titles", async () => {
    const stdout = await fixture("flat-playlist-with-deleted");
    const adapter = new YouTubeAdapter({ binary: "yt-dlp", execFile: fakeExecReturning(stdout) });
    const meta = await adapter.fetchPlaylist("https://www.youtube.com/playlist?list=PLDEL");
    const statuses = meta.items.map((i) => i.inferredStatus);
    expect(statuses).toEqual(["available", "removed", "private"]);
  });
});
