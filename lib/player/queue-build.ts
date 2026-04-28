import type { Kind, QueueItem } from "./types";

export function pickKind(item: QueueItem): Kind | null {
  if (item.availableKinds.includes(item.defaultKind)) return item.defaultKind;
  if (item.availableKinds.length > 0) return item.availableKinds[0]!;
  return null;
}

export interface BuildQueueResult {
  queue: QueueItem[];
  currentIndex: number;
}

export function buildQueue(items: QueueItem[], startAt: number): BuildQueueResult {
  const queue = items.filter((i) => i.availableKinds.length > 0);
  if (queue.length === 0) return { queue: [], currentIndex: -1 };
  // Count playable items at indices < startAt; that becomes the new index.
  let newIndex = 0;
  for (let i = 0; i < startAt && i < items.length; i++) {
    if (items[i]!.availableKinds.length > 0) newIndex++;
  }
  // If the clicked item itself was stripped, newIndex now points past it; clamp.
  if (newIndex >= queue.length) newIndex = queue.length - 1;
  return { queue, currentIndex: newIndex };
}
