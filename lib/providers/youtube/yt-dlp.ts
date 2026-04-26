// lib/providers/youtube/yt-dlp.ts
import { execFile as nodeExecFile } from "node:child_process";

export type ExecFileLike = (
  file: string,
  args: readonly string[],
  options: { timeout?: number; maxBuffer?: number },
  callback: (err: Error | null, stdout: string, stderr: string) => void,
) => void;

export interface RunYtDlpOptions {
  binary: string;
  execFile?: ExecFileLike;
  timeoutMs?: number;
  maxBufferBytes?: number;
}

export class YtDlpError extends Error {
  readonly code: number | null;
  readonly stderr: string;
  constructor(message: string, code: number | null, stderr: string) {
    super(message);
    this.name = "YtDlpError";
    this.code = code;
    this.stderr = stderr;
  }
}

export function runYtDlp(args: readonly string[], opts: RunYtDlpOptions): Promise<string> {
  const exec = opts.execFile ?? (nodeExecFile as unknown as ExecFileLike);
  const timeout = opts.timeoutMs ?? 30_000;
  const maxBuffer = opts.maxBufferBytes ?? 64 * 1024 * 1024;
  return new Promise<string>((resolve, reject) => {
    exec(opts.binary, args, { timeout, maxBuffer }, (err, stdout, stderr) => {
      if (err) {
        const code = (err as NodeJS.ErrnoException).code as unknown as number | null;
        reject(new YtDlpError(err.message, typeof code === "number" ? code : null, stderr ?? ""));
        return;
      }
      resolve(stdout);
    });
  });
}
