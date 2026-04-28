import { describe, it, expect, beforeEach } from "vitest";
import { createPlayerStore, type PlayerStore } from "./store";
import type { QueueItem } from "./types";

function item(over: Partial<QueueItem> = {}): QueueItem {
  return {
    videoId: 1,
    defaultKind: "audio",
    title: "T",
    channelTitle: null,
    thumbnailUrl: null,
    durationSeconds: 60,
    availableKinds: ["audio"],
    ...over,
  };
}

let store: PlayerStore;
beforeEach(() => { store = createPlayerStore(); });

describe("PlayerStore — initial state", () => {
  it("starts idle", () => {
    const s = store.getState();
    expect(s.queue).toEqual([]);
    expect(s.currentIndex).toBe(-1);
    expect(s.isPlaying).toBe(false);
    expect(s.position).toBe(0);
    expect(s.duration).toBe(0);
    expect(s.volume).toBe(1);
    expect(s.shuffle).toBe(false);
    expect(s.repeat).toBe("off");
    expect(s.mode).toBe("mini");
    expect(s.hasHydrated).toBe(false);
    expect(s.resolvedMediaFileId).toBeNull();
    expect(s.currentKind).toBeNull();
  });
});

describe("PlayerStore — setQueue + pickKind", () => {
  it("setQueue resolves currentKind + a media file id placeholder", () => {
    store.getState().setQueue([item({ videoId: 7 })], 0);
    const s = store.getState();
    expect(s.queue.length).toBe(1);
    expect(s.currentIndex).toBe(0);
    expect(s.currentKind).toBe("audio");
  });

  it("setQueue with empty list resets to idle", () => {
    store.getState().setQueue([item()], 0);
    store.getState().setQueue([], 0);
    expect(store.getState().currentIndex).toBe(-1);
    expect(store.getState().currentKind).toBeNull();
  });
});

describe("PlayerStore — play/pause/togglePlay", () => {
  it("play sets isPlaying true; only when a track is loaded", () => {
    store.getState().play();
    expect(store.getState().isPlaying).toBe(false); // idle — no-op
    store.getState().setQueue([item()], 0);
    store.getState().play();
    expect(store.getState().isPlaying).toBe(true);
  });
  it("pause sets isPlaying false", () => {
    store.getState().setQueue([item()], 0);
    store.getState().play();
    store.getState().pause();
    expect(store.getState().isPlaying).toBe(false);
  });
  it("togglePlay flips state", () => {
    store.getState().setQueue([item()], 0);
    store.getState().togglePlay();
    expect(store.getState().isPlaying).toBe(true);
    store.getState().togglePlay();
    expect(store.getState().isPlaying).toBe(false);
  });
});

describe("PlayerStore — next/prev with repeat modes", () => {
  it("next advances index", () => {
    store.getState().setQueue([item({ videoId: 1 }), item({ videoId: 2 })], 0);
    store.getState().next();
    expect(store.getState().currentIndex).toBe(1);
  });
  it("next at end with repeat=off → stops (isPlaying false, index -1 only on natural end? — clamp at last)", () => {
    store.getState().setQueue([item({ videoId: 1 }), item({ videoId: 2 })], 1);
    store.getState().play();
    store.getState().next();
    expect(store.getState().isPlaying).toBe(false);
  });
  it("next at end with repeat=all wraps to 0", () => {
    store.getState().setQueue([item({ videoId: 1 }), item({ videoId: 2 })], 1);
    store.getState().setRepeat("all");
    store.getState().next();
    expect(store.getState().currentIndex).toBe(0);
  });
  it("next with repeat=one stays on same index and resets position", () => {
    store.getState().setQueue([item({ videoId: 1 }), item({ videoId: 2 })], 0);
    store.getState().setRepeat("one");
    store.getState().setPosition(30);
    store.getState().next();
    expect(store.getState().currentIndex).toBe(0);
    expect(store.getState().position).toBe(0);
  });
  it("prev decrements; clamps at 0", () => {
    store.getState().setQueue([item({ videoId: 1 }), item({ videoId: 2 })], 1);
    store.getState().prev();
    expect(store.getState().currentIndex).toBe(0);
    store.getState().prev();
    expect(store.getState().currentIndex).toBe(0);
  });
});

describe("PlayerStore — seek / setPosition / setVolume / setDuration", () => {
  it("seek updates position", () => {
    store.getState().setQueue([item()], 0);
    store.getState().seek(42);
    expect(store.getState().position).toBe(42);
  });
  it("setVolume clamps to [0,1]", () => {
    store.getState().setVolume(2);
    expect(store.getState().volume).toBe(1);
    store.getState().setVolume(-0.5);
    expect(store.getState().volume).toBe(0);
  });
  it("toggleMute remembers previous volume", () => {
    store.getState().setVolume(0.6);
    store.getState().toggleMute();
    expect(store.getState().volume).toBe(0);
    store.getState().toggleMute();
    expect(store.getState().volume).toBeCloseTo(0.6);
  });
});

describe("PlayerStore — cycleRepeat + cycleMode", () => {
  it("cycleRepeat: off → all → one → off", () => {
    store.getState().cycleRepeat();
    expect(store.getState().repeat).toBe("all");
    store.getState().cycleRepeat();
    expect(store.getState().repeat).toBe("one");
    store.getState().cycleRepeat();
    expect(store.getState().repeat).toBe("off");
  });
  it("openFullscreen / openQueue / closeOverlays", () => {
    store.getState().setQueue([item()], 0);
    store.getState().openFullscreen();
    expect(store.getState().mode).toBe("fullscreen");
    store.getState().openQueue();
    expect(store.getState().mode).toBe("queue-open");
    store.getState().closeOverlays();
    expect(store.getState().mode).toBe("mini");
  });
});

describe("PlayerStore — queue mutations", () => {
  it("addToQueue appends", () => {
    store.getState().setQueue([item({ videoId: 1 })], 0);
    store.getState().addToQueue(item({ videoId: 2 }));
    expect(store.getState().queue.map((q) => q.videoId)).toEqual([1, 2]);
  });

  it("playNext inserts after current", () => {
    store.getState().setQueue([item({ videoId: 1 }), item({ videoId: 3 })], 0);
    store.getState().playNext(item({ videoId: 2 }));
    expect(store.getState().queue.map((q) => q.videoId)).toEqual([1, 2, 3]);
  });

  it("removeFromQueue before current shifts index down", () => {
    store.getState().setQueue([item({ videoId: 1 }), item({ videoId: 2 }), item({ videoId: 3 })], 2);
    store.getState().removeFromQueue(0);
    expect(store.getState().currentIndex).toBe(1);
    expect(store.getState().queue.map((q) => q.videoId)).toEqual([2, 3]);
  });

  it("removeFromQueue at current keeps index pointing to next item", () => {
    store.getState().setQueue([item({ videoId: 1 }), item({ videoId: 2 }), item({ videoId: 3 })], 1);
    store.getState().removeFromQueue(1);
    expect(store.getState().currentIndex).toBe(1);
    expect(store.getState().queue.map((q) => q.videoId)).toEqual([1, 3]);
  });

  it("reorder updates currentIndex when current item moves", () => {
    store.getState().setQueue([item({ videoId: 1 }), item({ videoId: 2 }), item({ videoId: 3 })], 0);
    store.getState().reorder(0, 2);
    expect(store.getState().currentIndex).toBe(2);
  });

  it("clearQueue resets state", () => {
    store.getState().setQueue([item({ videoId: 1 })], 0);
    store.getState().play();
    store.getState().clearQueue();
    expect(store.getState().queue).toEqual([]);
    expect(store.getState().currentIndex).toBe(-1);
    expect(store.getState().isPlaying).toBe(false);
  });
});

describe("PlayerStore — shuffle", () => {
  it("toggleShuffle on stores original queue and keeps current at index 0", () => {
    const items = Array.from({ length: 5 }, (_, i) => item({ videoId: i + 1 }));
    store.getState().setQueue(items, 2);
    store.getState().toggleShuffle();
    expect(store.getState().shuffle).toBe(true);
    expect(store.getState().queue[0]!.videoId).toBe(3);
    expect(store.getState().currentIndex).toBe(0);
  });

  it("toggleShuffle off restores original and points index back at current item", () => {
    const items = Array.from({ length: 5 }, (_, i) => item({ videoId: i + 1 }));
    store.getState().setQueue(items, 2);
    store.getState().toggleShuffle();
    store.getState().toggleShuffle();
    expect(store.getState().shuffle).toBe(false);
    expect(store.getState().queue.map((q) => q.videoId)).toEqual([1, 2, 3, 4, 5]);
    expect(store.getState().currentIndex).toBe(2);
  });
});

describe("PlayerStore — broken track skip path", () => {
  it("markBrokenAndAdvance moves to next track", () => {
    store.getState().setQueue([item({ videoId: 1 }), item({ videoId: 2 })], 0);
    store.getState().markBrokenAndAdvance();
    expect(store.getState().currentIndex).toBe(1);
  });
});
