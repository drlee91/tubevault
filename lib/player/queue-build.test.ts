import { describe, it, expect } from "vitest";
import { buildQueue, pickKind } from "./queue-build";
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

describe("pickKind", () => {
  it("returns defaultKind when available", () => {
    expect(pickKind(item({ defaultKind: "audio", availableKinds: ["audio", "video"] }))).toBe("audio");
  });
  it("falls back to the other kind when default missing", () => {
    expect(pickKind(item({ defaultKind: "audio", availableKinds: ["video"] }))).toBe("video");
  });
  it("returns null when no kinds available", () => {
    expect(pickKind(item({ availableKinds: [] }))).toBeNull();
  });
});

describe("buildQueue", () => {
  it("strips items with empty availableKinds and adjusts startAt", () => {
    const items: QueueItem[] = [
      item({ videoId: 1, availableKinds: [] }),
      item({ videoId: 2 }),
      item({ videoId: 3 }),
      item({ videoId: 4 }),
    ];
    const result = buildQueue(items, 2);
    expect(result.queue.map((q) => q.videoId)).toEqual([2, 3, 4]);
    expect(result.currentIndex).toBe(1);
  });

  it("clamps startAt down when the clicked item is stripped", () => {
    const items: QueueItem[] = [
      item({ videoId: 1 }),
      item({ videoId: 2, availableKinds: [] }),
      item({ videoId: 3 }),
    ];
    const result = buildQueue(items, 1);
    expect(result.queue.map((q) => q.videoId)).toEqual([1, 3]);
    expect(result.currentIndex).toBe(1);
  });

  it("returns empty queue and -1 index when no playable items", () => {
    const result = buildQueue([item({ availableKinds: [] })], 0);
    expect(result.queue).toEqual([]);
    expect(result.currentIndex).toBe(-1);
  });

  it("keeps single playable item at startAt 0", () => {
    const result = buildQueue([item()], 0);
    expect(result.currentIndex).toBe(0);
  });
});
