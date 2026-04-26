// lib/providers/youtube/yt-dlp.test.ts
import { describe, it, expect, vi } from "vitest";
import { runYtDlp, YtDlpError } from "./yt-dlp";

describe("runYtDlp", () => {
  it("invokes execFile with the configured binary and args, returns stdout", async () => {
    const fakeExec = vi
      .fn()
      .mockImplementation(
        (
          _file: string,
          _args: string[],
          _opts: unknown,
          cb: (err: Error | null, stdout: string, stderr: string) => void,
        ) => cb(null, "OK\n", ""),
      );
    const out = await runYtDlp(["--version"], { binary: "yt-dlp", execFile: fakeExec, timeoutMs: 5000 });
    expect(out).toBe("OK\n");
    expect(fakeExec).toHaveBeenCalledWith(
      "yt-dlp",
      ["--version"],
      expect.objectContaining({ timeout: 5000 }),
      expect.any(Function),
    );
  });

  it("wraps non-zero exits in YtDlpError carrying stderr", async () => {
    const fakeExec = vi
      .fn()
      .mockImplementation((_f, _a, _o, cb) =>
        cb(Object.assign(new Error("exit"), { code: 1 }), "", "Video unavailable"),
      );
    await expect(
      runYtDlp(["bogus"], { binary: "yt-dlp", execFile: fakeExec }),
    ).rejects.toBeInstanceOf(YtDlpError);
  });

  it("preserves stderr in YtDlpError.stderr", async () => {
    const fakeExec = vi
      .fn()
      .mockImplementation((_f, _a, _o, cb) =>
        cb(Object.assign(new Error("exit"), { code: 1 }), "", "boom"),
      );
    try {
      await runYtDlp(["x"], { binary: "yt-dlp", execFile: fakeExec });
    } catch (e) {
      expect(e).toBeInstanceOf(YtDlpError);
      expect((e as YtDlpError).stderr).toBe("boom");
    }
  });
});
