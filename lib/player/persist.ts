import type { PlayerStore, PlayerState } from "./store";

export const STORAGE_KEY = "tubevault.player";

export interface PersistedSlice {
  queue: PlayerState["queue"];
  currentIndex: number;
  position: number;
  volume: number;
  shuffle: boolean;
  repeat: PlayerState["repeat"];
}

export function snapshotForPersist(s: PlayerState): PersistedSlice {
  return {
    queue: s.queue,
    currentIndex: s.currentIndex,
    position: s.position,
    volume: s.volume,
    shuffle: s.shuffle,
    repeat: s.repeat,
  };
}

export function hydrateFrom(store: PlayerStore, raw: string | null): void {
  if (!raw) {
    store.getState().setHydrated(true);
    return;
  }
  let parsed: Partial<PersistedSlice> | null = null;
  try {
    parsed = JSON.parse(raw) as Partial<PersistedSlice>;
  } catch {
    store.getState().setHydrated(true);
    return;
  }
  if (!parsed || typeof parsed !== "object") {
    store.getState().setHydrated(true);
    return;
  }
  if (Array.isArray(parsed.queue) && parsed.queue.length > 0 && typeof parsed.currentIndex === "number") {
    store.getState().setQueue(parsed.queue, parsed.currentIndex);
  }
  if (typeof parsed.position === "number") store.getState().setPosition(parsed.position);
  if (typeof parsed.volume === "number") store.getState().setVolume(parsed.volume);
  if (parsed.repeat === "off" || parsed.repeat === "all" || parsed.repeat === "one") {
    store.getState().setRepeat(parsed.repeat);
  }
  store.getState().pause();
  store.getState().setHydrated(true);
}

export interface AttachOptions {
  debounceMs?: number;
}

export function attachPersist(store: PlayerStore, opts: AttachOptions = {}): () => void {
  const debounceMs = opts.debounceMs ?? 5000;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastSerialized = "";

  function flush() {
    const snap = snapshotForPersist(store.getState());
    const json = JSON.stringify(snap);
    if (json !== lastSerialized) {
      try { localStorage.setItem(STORAGE_KEY, json); } catch { /* quota — ignore */ }
      lastSerialized = json;
    }
    timer = null;
  }

  const unsubscribe = store.subscribe((state, prev) => {
    const changed =
      state.queue !== prev.queue ||
      state.currentIndex !== prev.currentIndex ||
      state.position !== prev.position ||
      state.volume !== prev.volume ||
      state.shuffle !== prev.shuffle ||
      state.repeat !== prev.repeat;
    if (!changed) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  });

  function onPageHide() { if (timer) { clearTimeout(timer); timer = null; } flush(); }
  window.addEventListener("pagehide", onPageHide);

  return () => {
    if (timer) clearTimeout(timer);
    window.removeEventListener("pagehide", onPageHide);
    unsubscribe();
  };
}
