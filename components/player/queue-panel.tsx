"use client";
import { X } from "lucide-react";
import { usePlayerStore, usePlayerStoreApi } from "@/lib/client/use-player-store";
import { QueueList } from "./queue-list";

export function QueuePanel() {
  const store = usePlayerStoreApi();
  const open = usePlayerStore((s) => s.mode === "queue-open");
  if (!open) return null;
  return (
    <aside
      aria-label="Queue"
      className="fixed bottom-[88px] right-4 top-16 z-20 hidden w-[360px] flex-col overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] md:flex"
    >
      <div className="flex items-center justify-end border-b border-[var(--color-line)] px-2 py-1">
        <button
          type="button"
          aria-label="Close queue"
          onClick={() => store.getState().closeOverlays()}
          className="rounded p-1 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <QueueList />
      </div>
    </aside>
  );
}
