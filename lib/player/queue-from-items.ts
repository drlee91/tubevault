import type { PlaylistDetailItem } from "@/lib/db/repositories/playlist-item-repo";
import type { VideoSerialized } from "@/lib/client/use-standalone-videos";
import type { Kind, QueueItem } from "./types";

export function fromPlaylistDetailItems(items: PlaylistDetailItem[], defaultFormat: Kind): QueueItem[] {
  return items.map((it) => ({
    videoId: it.video.id,
    defaultKind: defaultFormat,
    title: it.video.title,
    channelTitle: it.video.channelTitle,
    thumbnailUrl: it.video.thumbnailUrl,
    durationSeconds: it.video.durationSeconds,
    availableKinds: it.availableKinds,
  }));
}

export function fromStandaloneVideos(videos: VideoSerialized[]): QueueItem[] {
  return videos.map((v) => ({
    videoId: v.id,
    defaultKind: v.availableKinds.includes("audio") ? "audio" : "video",
    title: v.title,
    channelTitle: v.channelTitle,
    thumbnailUrl: v.thumbnailUrl,
    durationSeconds: v.durationSeconds,
    availableKinds: v.availableKinds,
  }));
}
