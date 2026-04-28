export type Kind = "audio" | "video";

export interface QueueItem {
  videoId: number;
  defaultKind: Kind;
  title: string;
  channelTitle: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  availableKinds: Kind[];
}

export type RepeatMode = "off" | "one" | "all";
export type PlayerMode = "mini" | "fullscreen" | "queue-open";
