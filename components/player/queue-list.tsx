"use client";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, AlertTriangle } from "lucide-react";
import { usePlayerStore, usePlayerStoreApi } from "@/lib/client/use-player-store";
import { NowPlayingIndicator } from "./now-playing-indicator";
import type { QueueItem } from "@/lib/player/types";

function Row({ item, index }: { item: QueueItem; index: number }) {
  const store = usePlayerStoreApi();
  const isCurrent = usePlayerStore((s) => s.currentIndex === index);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const sortable = useSortable({ id: `${item.videoId}-${index}` });
  const broken = item.availableKinds.length === 0;
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };
  return (
    <li
      ref={sortable.setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-[var(--color-muted-bg)]"
    >
      <button
        type="button"
        aria-label="Drag handle"
        {...sortable.attributes}
        {...sortable.listeners}
        className="cursor-grab text-[var(--color-muted)]"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {isCurrent ? <NowPlayingIndicator isPlaying={isPlaying} /> : <span className="w-2" />}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{item.title}</div>
        <div className="truncate text-xs text-[var(--color-muted)]">{item.channelTitle ?? ""}</div>
      </div>
      {broken && <AlertTriangle className="h-4 w-4 text-amber-500" aria-label="File missing" />}
      <button
        type="button"
        aria-label="Remove from queue"
        onClick={() => store.getState().removeFromQueue(index)}
        className="p-1 text-[var(--color-muted)]"
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  );
}

export function QueueList() {
  const store = usePlayerStoreApi();
  const queue = usePlayerStore((s) => s.queue);
  const ids = queue.map((q, i) => `${q.videoId}-${i}`);

  function handleDragEnd(ev: DragEndEvent) {
    const { active, over } = ev;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    store.getState().reorder(from, to);
    void arrayMove;
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
        <h2 className="text-sm font-semibold">Queue · {queue.length} tracks</h2>
        <button
          type="button"
          onClick={() => store.getState().clearQueue()}
          className="text-xs text-[var(--color-muted)] hover:underline"
        >
          Clear queue
        </button>
      </header>
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ol className="flex-1 overflow-auto p-2">
            {queue.map((q, i) => <Row key={`${q.videoId}-${i}`} item={q} index={i} />)}
          </ol>
        </SortableContext>
      </DndContext>
    </div>
  );
}
