import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
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

describe("YouTubeAdapter.fetchVideo", () => {
  it("parses --dump-json output into VideoMetadata", async () => {
    const stdout = await fixture("video-public");
    const a = new YouTubeAdapter({ binary: "yt-dlp", execFile: fakeExecReturning(stdout) });
    const meta = await a.fetchVideo("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(meta).toMatchObject({
      externalId: "dQw4w9WgXcQ",
      title: "Sample Public Video",
      channelTitle: "Channel A",
      channelId: "UCxyz",
      durationSeconds: 215,
      inferredStatus: "available",
      uploadDate: "20240115",
    });
  });
});

describe("YouTubeAdapter.checkAvailability", () => {
  it("parses pipe-separated output into status + reason", async () => {
    const a = new YouTubeAdapter({
      binary: "yt-dlp",
      execFile: fakeExecReturning("public|My Title\n"),
    });
    const probe = await a.checkAvailability("dQw4w9WgXcQ");
    expect(probe).toEqual({ status: "available", reason: "My Title" });
  });
  it("infers removed status from yt-dlp error stderr", async () => {
    const a = new YouTubeAdapter({
      binary: "yt-dlp",
      execFile: (_f, _a, _o, cb) =>
        cb(Object.assign(new Error("exit"), { code: 1 }), "", "ERROR: [youtube] xyz: Video unavailable"),
    });
    const probe = await a.checkAvailability("xyz");
    expect(probe.status).toBe("removed");
  });
});

describe("YouTubeAdapter.download", () => {
  it("invokes yt-dlp with audio extraction args and returns file metadata", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "tubevault-"));
    const audioPath = path.join(tmp, "Track One-abc111.mp3");
    await fs.writeFile(audioPath, Buffer.alloc(2048));

    let lastArgs: readonly string[] = [];
    const exec: ExecFileLike = (_f, args, _o, cb) => {
      lastArgs = args;
      cb(null, "[ffmpeg] Destination: " + audioPath + "\n", "");
    };
    const a = new YouTubeAdapter({ binary: "yt-dlp", execFile: exec });
    const result = await a.download("abc111", {
      kind: "audio",
      audioFormat: "mp3",
      audioBitrate: 192,
      outputDir: tmp,
      filenameStem: "Track One-abc111",
    });
    expect(result.filePath).toBe(audioPath);
    expect(result.format).toBe("mp3");
    expect(result.fileSizeBytes).toBe(2048);
    expect(lastArgs).toContain("-x");
    expect(lastArgs.join(" ")).toContain("--audio-format mp3");
  });
});
