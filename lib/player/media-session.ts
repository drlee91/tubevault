import type { PlayerStore } from "./store";
import type { QueueItem } from "./types";

function ms(): MediaSession | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as unknown as { mediaSession?: MediaSession }).mediaSession;
}

export function attachMediaSession(store: PlayerStore): () => void {
  const session = ms();
  if (!session) return () => {};
  session.setActionHandler("play", () => store.getState().play());
  session.setActionHandler("pause", () => store.getState().pause());
  session.setActionHandler("previoustrack", () => store.getState().prev());
  session.setActionHandler("nexttrack", () => store.getState().next());
  session.setActionHandler("seekto", (d) => {
    const seekTime = (d as { seekTime?: number }).seekTime ?? 0;
    store.getState().seek(seekTime);
  });
  return () => {
    const cur = ms();
    if (!cur) return;
    cur.setActionHandler("play", null);
    cur.setActionHandler("pause", null);
    cur.setActionHandler("previoustrack", null);
    cur.setActionHandler("nexttrack", null);
    cur.setActionHandler("seekto", null);
  };
}

export function updateMediaSessionMetadata(item: QueueItem | null): void {
  const session = ms();
  if (!session) return;
  if (!item) { session.metadata = null; return; }
  const Ctor = (window as unknown as { MediaMetadata?: typeof MediaMetadata }).MediaMetadata;
  if (!Ctor) return;
  session.metadata = new Ctor({
    title: item.title,
    artist: item.channelTitle ?? "",
    artwork: item.thumbnailUrl ? [{ src: item.thumbnailUrl }] : [],
  });
}
