"use client";
import { useEffect, useMemo } from "react";
import { createPlayerStore } from "@/lib/player/store";
import { attachPersist, hydrateFrom, STORAGE_KEY } from "@/lib/player/persist";
import { attachKeyboard } from "@/lib/player/keyboard";
import { attachMediaSession, updateMediaSessionMetadata } from "@/lib/player/media-session";
import { PlayerStoreProvider } from "@/lib/client/use-player-store";
import { createMediaFileResolver } from "@/lib/client/resolve-media-file";
import { PlayerCore } from "./player-core";

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const store = useMemo(() => createPlayerStore(), []);
  const resolver = useMemo(() => createMediaFileResolver(), []);

  useEffect(() => {
    hydrateFrom(store, typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null);
    const detachPersist = attachPersist(store);
    const detachKb = attachKeyboard(store);
    const detachMs = attachMediaSession(store);
    const unsub = store.subscribe((s, prev) => {
      if (s.currentIndex !== prev.currentIndex) {
        const it = s.queue[s.currentIndex];
        if (it) updateMediaSessionMetadata(it);
      }
    });
    return () => { detachPersist(); detachKb(); detachMs(); unsub(); };
  }, [store]);

  function resolve(videoId: number, kind: "audio" | "video"): number | null {
    const cached = resolver.get(videoId, kind);
    if (cached != null) return cached;
    void resolver.fetchAndCache(videoId);
    return null;
  }

  return (
    <PlayerStoreProvider store={store}>
      <PlayerCore resolveMediaFileId={resolve} />
      {children}
    </PlayerStoreProvider>
  );
}
