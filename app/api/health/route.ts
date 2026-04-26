import { NextResponse } from "next/server";
import { SelfCheckService } from "@/lib/services/self-check-service";
import { SettingsService } from "@/lib/services/settings-service";
import { SettingsRepository } from "@/lib/db/repositories/settings-repo";
import { getDb } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbPath = process.env.TUBEVAULT_DB_PATH ?? "./data/tubevault.db";
  const db = getDb(dbPath);
  const settings = new SettingsService(new SettingsRepository(db));

  const checker = new SelfCheckService({
    ytdlpPath: settings.getYtdlpPath() ?? process.env.TUBEVAULT_YTDLP_PATH ?? "yt-dlp",
    ffmpegPath: settings.getFfmpegPath() ?? process.env.TUBEVAULT_FFMPEG_PATH ?? "ffmpeg",
    audioStoragePath: settings.getAudioStoragePath(),
    videoStoragePath: settings.getVideoStoragePath(),
    dbPath,
  });

  const result = await checker.runAll();
  return NextResponse.json(result);
}
