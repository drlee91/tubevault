"use client";
import { useRef } from "react";
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1,
  Volume2, VolumeX, Maximize2, ListMusic,
} from "lucide-react";
import { usePlayerStore, usePlayerStoreApi } from "@/lib/client/use-player-store";
import { cn } from "@/lib/utils";

function formatTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function PlayerBar() {
  const store = usePlayerStoreApi();
  const item = usePlayerStore((s) => (s.currentIndex >= 0 ? s.queue[s.currentIndex] : null));
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const volume = usePlayerStore((s) => s.volume);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeat = usePlayerStore((s) => s.repeat);
  const mode = usePlayerStore((s) => s.mode);
  const stripeRef = useRef<HTMLDivElement | null>(null);

  if (!item) return null;

  function seekFromClick(ev: React.PointerEvent<HTMLDivElement>) {
    const rect = stripeRef.current!.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
    store.getState().seek(ratio * duration);
  }

  const RepeatIcon = repeat === "one" ? Repeat1 : Repeat;
  const repeatLabel = repeat === "off" ? "Repeat off" : repeat === "all" ? "Repeat all" : "Repeat one";

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 h-16 border-t border-[var(--color-line)] bg-[var(--color-bg)]">
      <div
        ref={stripeRef}
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.floor(duration)}
        aria-valuenow={Math.floor(position)}
        tabIndex={0}
        onPointerDown={seekFromClick}
        className="absolute inset-x-0 top-0 h-[2px] cursor-pointer bg-[var(--color-muted-bg)] hover:h-2"
      >
        <div
          className="h-full bg-[var(--color-accent,theme(colors.indigo.500))]"
          style={{ width: `${duration > 0 ? (position / duration) * 100 : 0}%` }}
        />
      </div>
      <div className="grid h-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-4">
        <div className="flex min-w-0 items-center gap-3">
          {item.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.thumbnailUrl} alt="" className="h-10 w-10 rounded object-cover" />
          ) : (
            <div className="h-10 w-10 rounded bg-[var(--color-muted-bg)]" />
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{item.title}</div>
            <div className="truncate text-xs text-[var(--color-fg-muted)]">{item.channelTitle ?? ""}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button aria-label="Shuffle" onClick={() => store.getState().toggleShuffle()} className={cn("p-1", shuffle && "text-[var(--color-brand)]")}>
            <Shuffle className="h-4 w-4" />
          </button>
          <button aria-label="Previous track" onClick={() => store.getState().prev()} className="p-1">
            <SkipBack className="h-5 w-5" />
          </button>
          <button
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={() => store.getState().togglePlay()}
            className="rounded-full bg-[var(--color-fg)] p-2 text-[var(--color-bg)]"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button aria-label="Next track" onClick={() => store.getState().next()} className="p-1">
            <SkipForward className="h-5 w-5" />
          </button>
          <button aria-label={repeatLabel} onClick={() => store.getState().cycleRepeat()} className={cn("p-1", repeat !== "off" && "text-[var(--color-brand)]")}>
            <RepeatIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center justify-end gap-3 text-xs tabular-nums text-[var(--color-fg-muted)]">
          <span>{formatTime(position)} / {formatTime(duration)}</span>
          <button
            aria-label="Open queue"
            aria-pressed={mode === "queue-open"}
            onClick={() => mode === "queue-open" ? store.getState().closeOverlays() : store.getState().openQueue()}
            className="p-1"
          >
            <ListMusic className="h-4 w-4" />
          </button>
          <button aria-label={volume === 0 ? "Unmute" : "Mute"} onClick={() => store.getState().toggleMute()} className="p-1">
            {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button aria-label="Open fullscreen" onClick={() => store.getState().openFullscreen()} className="p-1">
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
