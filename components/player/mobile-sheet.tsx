"use client";
import { Play, Pause } from "lucide-react";
import { usePlayerStore, usePlayerStoreApi } from "@/lib/client/use-player-store";
import { FullscreenAudio } from "./fullscreen-audio";
import { FullscreenVideo } from "./fullscreen-video";

export function MobilePlayerSheet() {
  const store = usePlayerStoreApi();
  const item = usePlayerStore((s) => (s.currentIndex >= 0 ? s.queue[s.currentIndex] : null));
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const kind = usePlayerStore((s) => s.currentKind);

  if (!item) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-14 z-10 flex h-14 items-center gap-2 border-t border-[var(--color-line)] bg-[var(--color-bg)] px-3 md:hidden">
        <button
          type="button"
          aria-label="Open player"
          onClick={() => store.getState().openFullscreen()}
          className="flex flex-1 items-center gap-2 text-left"
        >
          {item.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.thumbnailUrl} alt="" className="h-8 w-8 rounded object-cover" />
          ) : (
            <div className="h-8 w-8 rounded bg-[var(--color-muted-bg)]" />
          )}
          <span className="truncate text-sm">{item.title}</span>
        </button>
        <button
          aria-label={isPlaying ? "Pause" : "Resume"}
          onClick={(e) => { e.stopPropagation(); store.getState().togglePlay(); }}
          className="rounded-full bg-[var(--color-fg)] p-2 text-[var(--color-bg)]"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
      </div>
      {kind === "video" ? <FullscreenVideo /> : <FullscreenAudio />}
    </>
  );
}
