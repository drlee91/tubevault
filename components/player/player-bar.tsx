"use client";
import { useRef } from "react";
import {
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1,
  Volume2, VolumeX, Maximize2, ListMusic, Music,
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
  const seekTrackRef = useRef<HTMLDivElement | null>(null);

  if (!item) return null;

  function seekFromClick(ev: React.PointerEvent<HTMLDivElement>) {
    const rect = seekTrackRef.current!.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
    store.getState().seek(ratio * duration);
  }

  // ARIA slider pattern: arrows = small step, PageUp/Down = big step,
  // Home/End = bounds. Without this, keyboard users can focus the slider
  // (tabIndex) but not move it.
  function seekFromKey(ev: React.KeyboardEvent<HTMLDivElement>) {
    const s = store.getState();
    const step = 5;
    const bigStep = 30;
    let target: number | null = null;
    switch (ev.key) {
      case "ArrowRight":
      case "ArrowUp":
        target = Math.min(duration, s.position + step);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        target = Math.max(0, s.position - step);
        break;
      case "PageUp":
        target = Math.min(duration, s.position + bigStep);
        break;
      case "PageDown":
        target = Math.max(0, s.position - bigStep);
        break;
      case "Home":
        target = 0;
        break;
      case "End":
        target = duration;
        break;
    }
    if (target !== null) {
      ev.preventDefault();
      s.seek(target);
    }
  }

  const RepeatIcon = repeat === "one" ? Repeat1 : Repeat;
  const repeatLabel = repeat === "off" ? "Repeat off" : repeat === "all" ? "Repeat all" : "Repeat one";
  const fillPct = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 h-[72px] border-t border-[var(--color-line)] bg-[var(--color-muted-bg)]">
      <div className="mx-auto grid h-full max-w-[1400px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-4">

        {/* Left: artwork + title/channel */}
        <div className="flex min-w-0 items-center gap-3">
          <button
            aria-label="Open fullscreen"
            onClick={() => store.getState().openFullscreen()}
            className="shrink-0"
          >
            {item.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.thumbnailUrl}
                alt=""
                className="h-12 w-12 rounded-md object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[var(--color-surface-2)]">
                <Music className="h-5 w-5 text-[var(--color-fg-muted)]" />
              </div>
            )}
          </button>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{item.title}</div>
            <div className="truncate text-xs text-[var(--color-fg-muted)]">{item.channelTitle ?? ""}</div>
          </div>
        </div>

        {/* Center: transport + seek row */}
        <div className="flex flex-col items-center gap-1">
          {/* Transport row */}
          <div className="flex items-center gap-2">
            <button
              aria-label="Shuffle"
              onClick={() => store.getState().toggleShuffle()}
              className={cn("rounded p-1.5 text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]", shuffle && "text-[var(--color-brand)]")}
            >
              <Shuffle className="h-4 w-4" />
            </button>
            <button
              aria-label="Previous track"
              onClick={() => store.getState().prev()}
              className="rounded p-1.5 text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
            >
              <SkipBack className="h-5 w-5" />
            </button>
            <button
              aria-label={isPlaying ? "Pause" : "Play"}
              onClick={() => store.getState().togglePlay()}
              className="grid h-10 w-10 place-items-center rounded-full bg-[var(--color-brand)] text-[var(--color-brand-fg)] transition-transform hover:scale-105"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              aria-label="Next track"
              onClick={() => store.getState().next()}
              className="rounded p-1.5 text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
            >
              <SkipForward className="h-5 w-5" />
            </button>
            <button
              aria-label={repeatLabel}
              onClick={() => store.getState().cycleRepeat()}
              className={cn("rounded p-1.5 text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]", repeat !== "off" && "text-[var(--color-brand)]")}
            >
              <RepeatIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Seek row — fixed width because the parent grid column is `auto`
              and would otherwise collapse to the time labels' width. */}
          <div className="flex w-[clamp(240px,36vw,480px)] items-center gap-2">
            <span className="font-mono text-[11px] tabular-nums text-[var(--color-fg-muted)]">
              {formatTime(position)}
            </span>
            <div
              ref={seekTrackRef}
              role="slider"
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={Math.floor(duration)}
              aria-valuenow={Math.floor(position)}
              tabIndex={0}
              onPointerDown={seekFromClick}
              onKeyDown={seekFromKey}
              className="group relative h-1.5 w-full cursor-pointer rounded-full bg-[var(--color-line)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]"
            >
              {/* Fill */}
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-[var(--color-brand)]"
                style={{ width: `${fillPct}%` }}
              />
              {/* Thumb */}
              <div
                className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-[var(--color-fg)] opacity-0 transition-opacity group-hover:opacity-100"
                style={{ left: `${fillPct}%`, transform: `translateX(-50%) translateY(-50%)` }}
              />
            </div>
            <span className="font-mono text-[11px] tabular-nums text-[var(--color-fg-muted)]">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Right: volume, queue toggle, fullscreen */}
        <div className="flex items-center justify-end gap-1">
          <button
            aria-label={volume === 0 ? "Unmute" : "Mute"}
            onClick={() => store.getState().toggleMute()}
            className="rounded p-1.5 text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
          >
            {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button
            aria-label="Open queue"
            aria-pressed={mode === "queue-open"}
            onClick={() => mode === "queue-open" ? store.getState().closeOverlays() : store.getState().openQueue()}
            className="rounded p-1.5 text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
          >
            <ListMusic className="h-4 w-4" />
          </button>
          <button
            aria-label="Open fullscreen"
            onClick={() => store.getState().openFullscreen()}
            className="rounded p-1.5 text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
