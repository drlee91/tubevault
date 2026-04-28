import type { MediaFileRepo, MediaFileRow } from "@/lib/db/repositories/media-file-repo";

export interface MediaFileServiceDeps {
  mediaFileRepo: MediaFileRepo;
}

export class MediaFileService {
  constructor(private readonly d: MediaFileServiceDeps) {}

  byId(id: number): MediaFileRow | null {
    return this.d.mediaFileRepo.byId(id);
  }
}

export function mimeForFormat(format: string): string {
  switch (format) {
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/mp4";
    case "opus":
      return "audio/ogg";
    case "flac":
      return "audio/flac";
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "mkv":
      return "video/x-matroska";
    default:
      return "application/octet-stream";
  }
}
