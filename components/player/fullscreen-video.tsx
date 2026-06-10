"use client";
import { useEffect, useState } from "react";
import { X, Maximize2 } from "lucide-react";
import { usePlayerStore, usePlayerStoreApi } from "@/lib/client/use-player-store";

export function FullscreenVideo() {
  const store = usePlayerStoreApi();
  const open = usePlayerStore((s) => s.mode === "fullscreen");
  const kind = usePlayerStore((s) => s.currentKind);
  const [showControls, setShowControls] = useState(true);

  useEffect(() => {
    if (!open) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    function show() {
      setShowControls(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setShowControls(false), 3000);
    }
    show();
    document.addEventListener("mousemove", show);
    return () => { document.removeEventListener("mousemove", show); if (timer) clearTimeout(timer); };
  }, [open]);

  if (!open || kind !== "video") return null;

  // The actual <video> element is rendered by PlayerCore's fullscreen
  // overlay (z-30). This component layers controls above it (z-40) without
  // its own backdrop.
  function expandNative() {
    const v = document.querySelector<HTMLVideoElement>("video[src]");
    if (v && v.requestFullscreen) void v.requestFullscreen();
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      {showControls && (
        <div className="pointer-events-auto absolute right-4 top-4 flex gap-2">
          <button aria-label="Expand" onClick={expandNative} className="rounded-lg bg-black/60 p-2 text-white backdrop-blur hover:bg-black/80"><Maximize2 className="h-5 w-5" /></button>
          <button aria-label="Close" onClick={() => store.getState().closeOverlays()} className="rounded-lg bg-black/60 p-2 text-white backdrop-blur hover:bg-black/80"><X className="h-5 w-5" /></button>
        </div>
      )}
    </div>
  );
}
