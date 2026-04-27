import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir, platform } from "node:os";
import path from "node:path";
import { SelfCheckService, type CheckRunner } from "./self-check-service";

// On Windows, "/nonexistent/forbidden/path" resolves to the current drive root
// where the user can usually create directories. Use a drive letter that does
// not exist instead. On POSIX systems, "/nonexistent/forbidden/path" is not
// writable for an unprivileged user.
const UNWRITABLE_PATH =
  platform() === "win32" ? "Z:\\nonexistent\\forbidden\\path" : "/nonexistent/forbidden/path";

function makeFakeRunner(map: Record<string, { ok: boolean; output?: string }>): CheckRunner {
  return async (file, args) => {
    const key = `${file} ${args.join(" ")}`;
    const entry = map[key];
    if (!entry) return { ok: false, output: `command not found: ${file}` };
    return entry;
  };
}

describe("SelfCheckService", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "tubevault-selfcheck-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("reports yt-dlp ok when runner succeeds", async () => {
    const svc = new SelfCheckService({
      ytdlpPath: "yt-dlp",
      ffmpegPath: "ffmpeg",
      audioStoragePath: tempDir,
      videoStoragePath: tempDir,
      dbPath: path.join(tempDir, "db.sqlite"),
      runner: makeFakeRunner({
        "yt-dlp --version": { ok: true, output: "2026.01.01" },
        "ffmpeg -version": { ok: true, output: "ffmpeg version 7.0" },
      }),
    });

    const result = await svc.runAll();
    expect(result.checks.find((c) => c.name === "yt-dlp")?.status).toBe("ok");
    expect(result.checks.find((c) => c.name === "yt-dlp")?.detail).toContain("2026.01.01");
  });

  it("reports yt-dlp error when runner fails", async () => {
    const svc = new SelfCheckService({
      ytdlpPath: "yt-dlp",
      ffmpegPath: "ffmpeg",
      audioStoragePath: tempDir,
      videoStoragePath: tempDir,
      dbPath: path.join(tempDir, "db.sqlite"),
      runner: makeFakeRunner({
        "ffmpeg -version": { ok: true, output: "ffmpeg version 7.0" },
      }),
    });

    const result = await svc.runAll();
    const ytdlp = result.checks.find((c) => c.name === "yt-dlp");
    expect(ytdlp?.status).toBe("error");
  });

  it("reports storage path error when path doesn't exist and can't be created", async () => {
    const svc = new SelfCheckService({
      ytdlpPath: "yt-dlp",
      ffmpegPath: "ffmpeg",
      audioStoragePath: UNWRITABLE_PATH,
      videoStoragePath: tempDir,
      dbPath: path.join(tempDir, "db.sqlite"),
      runner: makeFakeRunner({
        "yt-dlp --version": { ok: true, output: "x" },
        "ffmpeg -version": { ok: true, output: "x" },
      }),
    });

    const result = await svc.runAll();
    const audio = result.checks.find((c) => c.name === "audio_storage");
    expect(audio?.status).toBe("error");
  });

  it("reports storage path ok when path exists and is writable", async () => {
    const svc = new SelfCheckService({
      ytdlpPath: "yt-dlp",
      ffmpegPath: "ffmpeg",
      audioStoragePath: tempDir,
      videoStoragePath: tempDir,
      dbPath: path.join(tempDir, "db.sqlite"),
      runner: makeFakeRunner({
        "yt-dlp --version": { ok: true, output: "x" },
        "ffmpeg -version": { ok: true, output: "x" },
      }),
    });

    const result = await svc.runAll();
    expect(result.checks.find((c) => c.name === "audio_storage")?.status).toBe("ok");
    expect(result.checks.find((c) => c.name === "video_storage")?.status).toBe("ok");
  });

  it("reports db ok when file exists", async () => {
    const dbPath = path.join(tempDir, "db.sqlite");
    writeFileSync(dbPath, "");
    const svc = new SelfCheckService({
      ytdlpPath: "yt-dlp",
      ffmpegPath: "ffmpeg",
      audioStoragePath: tempDir,
      videoStoragePath: tempDir,
      dbPath,
      runner: makeFakeRunner({
        "yt-dlp --version": { ok: true, output: "x" },
        "ffmpeg -version": { ok: true, output: "x" },
      }),
    });

    const result = await svc.runAll();
    expect(result.checks.find((c) => c.name === "database")?.status).toBe("ok");
  });

  it("overall status is 'error' if any check is error", async () => {
    const svc = new SelfCheckService({
      ytdlpPath: "yt-dlp",
      ffmpegPath: "ffmpeg",
      audioStoragePath: tempDir,
      videoStoragePath: tempDir,
      dbPath: path.join(tempDir, "db.sqlite"),
      runner: makeFakeRunner({
        "ffmpeg -version": { ok: true, output: "x" },
      }),
    });

    const result = await svc.runAll();
    expect(result.overall).toBe("error");
  });

  it("overall status is 'ok' when all checks pass", async () => {
    writeFileSync(path.join(tempDir, "db.sqlite"), "");
    const svc = new SelfCheckService({
      ytdlpPath: "yt-dlp",
      ffmpegPath: "ffmpeg",
      audioStoragePath: tempDir,
      videoStoragePath: tempDir,
      dbPath: path.join(tempDir, "db.sqlite"),
      runner: makeFakeRunner({
        "yt-dlp --version": { ok: true, output: "x" },
        "ffmpeg -version": { ok: true, output: "x" },
      }),
    });

    const result = await svc.runAll();
    expect(result.overall).toBe("ok");
  });

  describe("checkPathWritable", () => {
    it("returns true for an existing writable directory", async () => {
      const svc = new SelfCheckService({
        ytdlpPath: "yt-dlp",
        ffmpegPath: "ffmpeg",
        audioStoragePath: tempDir,
        videoStoragePath: tempDir,
        dbPath: path.join(tempDir, "db.sqlite"),
      });
      expect(await svc.checkPathWritable(tempDir)).toBe(true);
    });

    it("returns false for a non-existent path", async () => {
      const svc = new SelfCheckService({
        ytdlpPath: "yt-dlp",
        ffmpegPath: "ffmpeg",
        audioStoragePath: tempDir,
        videoStoragePath: tempDir,
        dbPath: path.join(tempDir, "db.sqlite"),
      });
      expect(await svc.checkPathWritable(UNWRITABLE_PATH)).toBe(false);
    });

    it("returns false for a file (not a directory)", async () => {
      const filePath = path.join(tempDir, "regular-file.txt");
      writeFileSync(filePath, "hello");
      const svc = new SelfCheckService({
        ytdlpPath: "yt-dlp",
        ffmpegPath: "ffmpeg",
        audioStoragePath: tempDir,
        videoStoragePath: tempDir,
        dbPath: path.join(tempDir, "db.sqlite"),
      });
      expect(await svc.checkPathWritable(filePath)).toBe(false);
    });
  });
});
