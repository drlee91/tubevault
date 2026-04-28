"use client";
import { cn } from "@/lib/utils";

export function NowPlayingIndicator({ isPlaying }: { isPlaying: boolean }) {
  return (
    <span
      aria-label="Now playing"
      role="status"
      className={cn(
        "inline-block h-2 w-2 rounded-full bg-[var(--color-accent,theme(colors.indigo.500))]",
        isPlaying && "animate-pulse",
      )}
    />
  );
}
