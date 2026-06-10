"use client";
import { useEffect, useState } from "react";
import { X, Music, Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { usePlayerStore, usePlayerStoreApi } from "@/lib/client/use-player-store";
import { QueueList } from "./queue-list";

function fmt(s: number) {
  const m = Math.floor(s / 60); const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function FullscreenAudio() {
  const store = usePlayerStoreApi();
  const open = usePlayerStore((s) => s.mode === "fullscreen");
  const kind = usePlayerStore((s) => s.currentKind);
  const item = usePlayerStore((s) => (s.currentIndex >= 0 ? s.queue[s.currentIndex] : null));
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const [tab, setTab] = useState<"now" | "queue">("now");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") store.getState().closeOverlays(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, store]);

  // Video tracks get PlayerCore's video overlay + <FullscreenVideo> controls.
  // Without the kind guard this pane (same z-index, later in the DOM) would
  // paint over the video.
  if (!open || !item || kind !== "audio") return null;

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-[var(--color-bg)]">
      <header className="flex justify-end p-3">
        <button aria-label="Close" onClick={() => store.getState().closeOverlays()} className="p-2">
          <X className="h-5 w-5" />
        </button>
      </header>
      {tab === "now" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
          <div className="grid h-[420px] w-[420px] max-h-[80vw] max-w-[80vw] place-items-center rounded-xl bg-[var(--color-muted-bg)]">
            {item.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.thumbnailUrl} alt="" className="h-full w-full rounded-xl object-cover" />
            ) : (
              <Music className="h-16 w-16 text-[var(--color-fg-muted)]" />
            )}
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold">{item.title}</div>
            <div className="text-sm text-[var(--color-fg-muted)]">{item.channelTitle ?? ""}</div>
          </div>
          <div className="w-full max-w-md">
            <input
              type="range"
              aria-label="Seek"
              min={0}
              max={Math.floor(duration)}
              value={Math.floor(position)}
              onChange={(e) => store.getState().seek(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs tabular-nums text-[var(--color-fg-muted)]">
              <span>{fmt(position)}</span><span>{fmt(duration)}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button aria-label="Previous track" onClick={() => store.getState().prev()} className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"><SkipBack className="h-6 w-6" /></button>
            <button
              aria-label={isPlaying ? "Pause" : "Play"}
              onClick={() => store.getState().togglePlay()}
              className="rounded-full bg-[var(--color-brand)] p-4 text-[var(--color-brand-fg)] transition-transform hover:scale-105"
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <button aria-label="Next track" onClick={() => store.getState().next()} className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"><SkipForward className="h-6 w-6" /></button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto"><QueueList /></div>
      )}
      <nav role="tablist" className="flex justify-center gap-2 border-t border-[var(--color-line)] py-2">
        <button role="tab" aria-selected={tab === "now"} onClick={() => setTab("now")} className={`px-3 py-1 text-sm ${tab === "now" ? "border-b-2 border-[var(--color-brand)] text-[var(--color-fg)]" : "text-[var(--color-fg-muted)]"}`}>Now Playing</button>
        <button role="tab" aria-selected={tab === "queue"} onClick={() => setTab("queue")} className={`px-3 py-1 text-sm ${tab === "queue" ? "border-b-2 border-[var(--color-brand)] text-[var(--color-fg)]" : "text-[var(--color-fg-muted)]"}`}>Queue</button>
      </nav>
    </div>
  );
}
