import { createStore, type StoreApi } from "zustand/vanilla";
import type { Kind, PlayerMode, QueueItem, RepeatMode } from "./types";
import { pickKind } from "./queue-build";

export interface PlayerState {
  queue: QueueItem[];
  currentIndex: number;
  resolvedMediaFileId: number | null;
  currentKind: Kind | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  volume: number;
  preMuteVolume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  mode: PlayerMode;
  hasHydrated: boolean;
  _originalQueue: QueueItem[] | null;
}

export interface PlayerActions {
  setQueue(items: QueueItem[], startIndex: number): void;
  addToQueue(item: QueueItem): void;
  playNext(item: QueueItem): void;
  removeFromQueue(index: number): void;
  reorder(from: number, to: number): void;
  clearQueue(): void;

  play(): void;
  pause(): void;
  togglePlay(): void;
  next(): void;
  prev(): void;
  seek(seconds: number): void;
  setPosition(seconds: number): void;
  setDuration(seconds: number): void;
  setVolume(v: number): void;
  toggleMute(): void;
  toggleShuffle(): void;
  setRepeat(r: RepeatMode): void;
  cycleRepeat(): void;

  openFullscreen(): void;
  openQueue(): void;
  closeOverlays(): void;

  markBrokenAndAdvance(): void;
  setHydrated(v: boolean): void;
  _resolve(): void;
}

export type PlayerStore = StoreApi<PlayerState & PlayerActions>;

const initial: PlayerState = {
  queue: [],
  currentIndex: -1,
  resolvedMediaFileId: null,
  currentKind: null,
  isPlaying: false,
  position: 0,
  duration: 0,
  volume: 1,
  preMuteVolume: 1,
  shuffle: false,
  repeat: "off",
  mode: "mini",
  hasHydrated: false,
  _originalQueue: null,
};

export function createPlayerStore(): PlayerStore {
  return createStore<PlayerState & PlayerActions>((set, get) => ({
    ...initial,

    setQueue(items, startIndex) {
      if (items.length === 0) {
        set({ queue: [], currentIndex: -1, currentKind: null, resolvedMediaFileId: null, isPlaying: false, position: 0 });
        return;
      }
      const idx = Math.max(0, Math.min(startIndex, items.length - 1));
      set({ queue: items, currentIndex: idx, position: 0, _originalQueue: null });
      get()._resolve();
    },
    addToQueue(item) {
      set({ queue: [...get().queue, item] });
    },
    playNext(item) {
      const { queue, currentIndex } = get();
      const insertAt = currentIndex >= 0 ? currentIndex + 1 : queue.length;
      const next = [...queue];
      next.splice(insertAt, 0, item);
      set({ queue: next });
    },
    removeFromQueue(index) {
      const { queue, currentIndex } = get();
      if (index < 0 || index >= queue.length) return;
      const next = queue.filter((_, i) => i !== index);
      let newIdx = currentIndex;
      if (index < currentIndex) newIdx = currentIndex - 1;
      else if (index === currentIndex) {
        newIdx = currentIndex >= next.length ? next.length - 1 : currentIndex;
      }
      set({ queue: next, currentIndex: next.length === 0 ? -1 : newIdx, position: index === currentIndex ? 0 : get().position });
      get()._resolve();
    },
    reorder(from, to) {
      const { queue, currentIndex } = get();
      if (from === to) return;
      if (from < 0 || from >= queue.length || to < 0 || to >= queue.length) return;
      const next = [...queue];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      let newIdx = currentIndex;
      if (currentIndex === from) newIdx = to;
      else if (from < currentIndex && to >= currentIndex) newIdx = currentIndex - 1;
      else if (from > currentIndex && to <= currentIndex) newIdx = currentIndex + 1;
      set({ queue: next, currentIndex: newIdx });
    },
    clearQueue() {
      set({ queue: [], currentIndex: -1, isPlaying: false, currentKind: null, resolvedMediaFileId: null, position: 0 });
    },

    play() {
      if (get().currentIndex < 0) return;
      set({ isPlaying: true });
    },
    pause() { set({ isPlaying: false }); },
    togglePlay() { get().isPlaying ? get().pause() : get().play(); },

    next() {
      const { queue, currentIndex, repeat } = get();
      if (queue.length === 0) return;
      if (repeat === "one") {
        set({ position: 0 });
        return;
      }
      const last = queue.length - 1;
      if (currentIndex >= last) {
        if (repeat === "all") {
          set({ currentIndex: 0, position: 0 });
          get()._resolve();
        } else {
          set({ isPlaying: false, position: 0 });
        }
        return;
      }
      set({ currentIndex: currentIndex + 1, position: 0 });
      get()._resolve();
    },
    prev() {
      const { currentIndex } = get();
      if (currentIndex <= 0) {
        set({ position: 0 });
        return;
      }
      set({ currentIndex: currentIndex - 1, position: 0 });
      get()._resolve();
    },

    seek(seconds) { set({ position: Math.max(0, seconds) }); },
    setPosition(seconds) { set({ position: Math.max(0, seconds) }); },
    setDuration(seconds) { set({ duration: Math.max(0, seconds) }); },
    setVolume(v) {
      const clamped = Math.max(0, Math.min(1, v));
      set({ volume: clamped, preMuteVolume: clamped > 0 ? clamped : get().preMuteVolume });
    },
    toggleMute() {
      const { volume, preMuteVolume } = get();
      if (volume > 0) set({ preMuteVolume: volume, volume: 0 });
      else set({ volume: preMuteVolume > 0 ? preMuteVolume : 1 });
    },
    toggleShuffle() {
      const { queue, currentIndex, shuffle, _originalQueue } = get();
      if (shuffle) {
        if (_originalQueue) {
          const currentItem = queue[currentIndex];
          const newIdx = currentItem ? _originalQueue.findIndex((q) => q.videoId === currentItem.videoId) : 0;
          set({ queue: _originalQueue, currentIndex: newIdx >= 0 ? newIdx : 0, shuffle: false, _originalQueue: null });
        } else {
          set({ shuffle: false });
        }
        return;
      }
      if (queue.length <= 1) { set({ shuffle: true, _originalQueue: queue.slice() }); return; }
      const original = queue.slice();
      const head = currentIndex >= 0 ? [queue[currentIndex]!] : [];
      const tail = queue.filter((_, i) => i !== currentIndex);
      for (let i = tail.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tail[i], tail[j]] = [tail[j]!, tail[i]!];
      }
      const next = [...head, ...tail];
      set({ queue: next, currentIndex: head.length > 0 ? 0 : -1, shuffle: true, _originalQueue: original });
    },
    setRepeat(r) { set({ repeat: r }); },
    cycleRepeat() {
      const r = get().repeat;
      set({ repeat: r === "off" ? "all" : r === "all" ? "one" : "off" });
    },

    openFullscreen() { if (get().currentIndex >= 0) set({ mode: "fullscreen" }); },
    openQueue() { set({ mode: "queue-open" }); },
    closeOverlays() { set({ mode: "mini" }); },

    markBrokenAndAdvance() {
      get().next();
    },
    setHydrated(v) { set({ hasHydrated: v }); },

    _resolve() {
      const { queue, currentIndex } = get();
      const it = currentIndex >= 0 ? queue[currentIndex] : null;
      if (!it) {
        set({ currentKind: null, resolvedMediaFileId: null });
        return;
      }
      const kind = pickKind(it);
      set({ currentKind: kind, resolvedMediaFileId: null });
    },
  }));
}
