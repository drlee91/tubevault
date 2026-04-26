import { mkdirSync, accessSync, constants, existsSync } from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export type CheckStatus = "ok" | "warn" | "error";

export interface CheckResult {
  name: string;
  status: CheckStatus;
  detail: string;
}

export interface SelfCheckResult {
  overall: CheckStatus;
  checks: CheckResult[];
}

export type CheckRunner = (cmd: string) => Promise<{ ok: boolean; output?: string }>;

const defaultRunner: CheckRunner = async (cmd) => {
  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: 5000 });
    return { ok: true, output: (stdout || stderr).trim() };
  } catch (err) {
    return { ok: false, output: err instanceof Error ? err.message : String(err) };
  }
};

export interface SelfCheckOptions {
  ytdlpPath: string;
  ffmpegPath: string;
  audioStoragePath: string;
  videoStoragePath: string;
  dbPath: string;
  runner?: CheckRunner;
}

export class SelfCheckService {
  private runner: CheckRunner;

  constructor(private readonly opts: SelfCheckOptions) {
    this.runner = opts.runner ?? defaultRunner;
  }

  async runAll(): Promise<SelfCheckResult> {
    const checks: CheckResult[] = [];
    checks.push(await this.checkExternal("yt-dlp", `${this.opts.ytdlpPath} --version`));
    checks.push(await this.checkExternal("ffmpeg", `${this.opts.ffmpegPath} -version`));
    checks.push(this.checkStoragePath("audio_storage", this.opts.audioStoragePath));
    checks.push(this.checkStoragePath("video_storage", this.opts.videoStoragePath));
    checks.push(this.checkDatabase());

    const worst = checks.reduce<CheckStatus>((acc, c) => {
      if (c.status === "error" || acc === "error") return "error";
      if (c.status === "warn" || acc === "warn") return "warn";
      return "ok";
    }, "ok");

    return { overall: worst, checks };
  }

  private async checkExternal(name: string, cmd: string): Promise<CheckResult> {
    const result = await this.runner(cmd);
    if (result.ok) {
      const firstLine = (result.output ?? "").split("\n")[0]?.trim() ?? "";
      return { name, status: "ok", detail: firstLine || "found" };
    }
    return {
      name,
      status: "error",
      detail: `not found or not executable: ${result.output ?? ""}`.trim(),
    };
  }

  private checkStoragePath(name: string, p: string): CheckResult {
    try {
      if (!existsSync(p)) {
        mkdirSync(p, { recursive: true });
      }
      accessSync(p, constants.W_OK);
      return { name, status: "ok", detail: p };
    } catch (err) {
      return {
        name,
        status: "error",
        detail: `${p}: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  private checkDatabase(): CheckResult {
    if (existsSync(this.opts.dbPath)) {
      return { name: "database", status: "ok", detail: this.opts.dbPath };
    }
    return {
      name: "database",
      status: "warn",
      detail: `not yet created at ${this.opts.dbPath} (will be created on first migration)`,
    };
  }
}
