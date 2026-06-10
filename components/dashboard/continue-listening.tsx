"use client";
import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { usePlayerStoreApiOptional } from "@/lib/client/use-player-store";
import { STORAGE_KEY, type PersistedSlice } from "@/lib/player/persist";
import { Duration } from "@/components/shared/duration";

export function ContinueListening() {
  const store = usePlayerStoreApiOptional();
  const [slice, setSlice] = useState<PersistedSlice | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<PersistedSlice>;
      if (Array.isArray(parsed.queue) && parsed.queue.length > 0 && typeof parsed.currentIndex === "number") {
        setSlice(parsed as PersistedSlice);
      }
    } catch {
      /* corrupted persistence — render nothing */
    }
  }, []);

  if (!slice || !store) return null;
  const current = slice.queue[slice.currentIndex];
  if (!current) return null;

  function resume(index: number, position: number) {
    const s = store!.getState();
    s.setQueue(slice!.queue, index);
    if (position > 0) s.seek(position);
    s.play();
  }

  return (
    <section aria-label="Continue listening">
      <h2 className="mb-3 text-lg font-semibold">Weiter hören</h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {[current, ...slice.queue.filter((_, i) => i !== slice.currentIndex).slice(0, 7)].map((item) => {
          const index = slice.queue.indexOf(item);
          const isCurrent = index === slice.currentIndex;
          return (
            <button
              key={`${item.videoId}-${index}`}
              type="button"
              onClick={() => resume(index, isCurrent ? slice.position : 0)}
              className="group w-44 shrink-0 overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-muted-bg)] text-left transition-colors hover:border-[var(--color-faint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]"
            >
              <div className="relative aspect-video bg-[var(--color-surface-2)]">
                {item.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                )}
                <span className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <Play className="h-6 w-6 text-white" />
                </span>
              </div>
              <div className="p-2.5">
                <div className="line-clamp-2 text-xs font-medium leading-snug">{item.title}</div>
                <div className="mt-1 text-[11px] text-[var(--color-fg-muted)]">
                  {isCurrent ? <>bei <Duration seconds={Math.floor(slice.position)} /></> : <Duration seconds={item.durationSeconds} />}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
