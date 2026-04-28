// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { createPlayerStore } from "./store";
import { hydrateFrom, snapshotForPersist, attachPersist, STORAGE_KEY } from "./persist";

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

describe("snapshotForPersist", () => {
  it("includes queue, currentIndex, position, volume, shuffle, repeat — and sets isPlaying false", () => {
    const store = createPlayerStore();
    store.getState().setQueue([{
      videoId: 1, defaultKind: "audio", title: "T",
      channelTitle: null, thumbnailUrl: null, durationSeconds: 60,
      availableKinds: ["audio"],
    }], 0);
    store.getState().play();
    store.getState().setPosition(42);
    store.getState().setVolume(0.5);
    store.getState().setRepeat("all");
    const snap = snapshotForPersist(store.getState());
    expect(snap.currentIndex).toBe(0);
    expect(snap.position).toBe(42);
    expect(snap.volume).toBe(0.5);
    expect(snap.repeat).toBe("all");
    expect(snap.queue.length).toBe(1);
    expect("isPlaying" in snap).toBe(false);
  });
});

describe("hydrateFrom", () => {
  it("rehydrates queue, position, volume; isPlaying always false", () => {
    const store = createPlayerStore();
    hydrateFrom(store, JSON.stringify({
      queue: [{ videoId: 9, defaultKind: "audio", title: "T", channelTitle: null,
        thumbnailUrl: null, durationSeconds: 60, availableKinds: ["audio"] }],
      currentIndex: 0,
      position: 12,
      volume: 0.7,
      shuffle: false,
      repeat: "off",
    }));
    const s = store.getState();
    expect(s.currentIndex).toBe(0);
    expect(s.position).toBe(12);
    expect(s.volume).toBe(0.7);
    expect(s.isPlaying).toBe(false);
    expect(s.hasHydrated).toBe(true);
  });

  it("treats malformed JSON as empty hydrate", () => {
    const store = createPlayerStore();
    hydrateFrom(store, "{not json");
    expect(store.getState().hasHydrated).toBe(true);
    expect(store.getState().queue).toEqual([]);
  });
});

describe("attachPersist", () => {
  it("debounces position writes (5s) and writes immediately on pagehide", () => {
    const store = createPlayerStore();
    const detach = attachPersist(store, { debounceMs: 5000 });
    store.getState().setQueue([{
      videoId: 1, defaultKind: "audio", title: "T",
      channelTitle: null, thumbnailUrl: null, durationSeconds: 60,
      availableKinds: ["audio"],
    }], 0);
    store.getState().setPosition(10);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    vi.advanceTimersByTime(5001);
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    // Trigger pagehide manually
    store.getState().setPosition(20);
    window.dispatchEvent(new Event("pagehide"));
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.position).toBe(20);
    detach();
  });
});
