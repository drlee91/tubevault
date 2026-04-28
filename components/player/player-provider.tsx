"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [cacheBump, setCacheBump] = useState(0);

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

  const resolve = useCallback((videoId: number, kind: "audio" | "video"): number | null | undefined => {
    const cached = resolver.get(videoId, kind);
    if (cached !== undefined) return cached; // null = definitively missing, number = found
    // Cache miss: fetch in-flight; bump state when done so PlayerCore re-renders.
    void resolver.fetchAndCache(videoId).then(() => {
      setCacheBump((n) => n + 1);
    });
    return undefined; // signal: still loading
  }, [resolver]);

  return (
    <PlayerStoreProvider store={store}>
      <PlayerCore resolveMediaFileId={resolve} cacheVersion={cacheBump} />
      {children}
    </PlayerStoreProvider>
  );
}
