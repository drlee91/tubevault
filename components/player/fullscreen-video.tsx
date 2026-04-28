"use client";
import { useEffect, useRef, useState } from "react";
import { X, Maximize2 } from "lucide-react";
import { usePlayerStore, usePlayerStoreApi } from "@/lib/client/use-player-store";

export function FullscreenVideo() {
  const store = usePlayerStoreApi();
  const open = usePlayerStore((s) => s.mode === "fullscreen");
  const kind = usePlayerStore((s) => s.currentKind);
  const wrapRef = useRef<HTMLDivElement | null>(null);
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

  function expandNative() {
    const v = wrapRef.current?.querySelector("video");
    if (v && v.requestFullscreen) void v.requestFullscreen();
  }

  return (
    <div ref={wrapRef} className="fixed inset-0 z-30 grid place-items-center bg-black/95">
      {/* Hidden video element used as target for native fullscreen */}
      <video className="hidden" aria-hidden="true" />
      <div className="absolute inset-0 grid place-items-center p-4" />
      {showControls && (
        <div className="absolute right-4 top-4 flex gap-2">
          <button aria-label="Expand" onClick={expandNative} className="rounded bg-white/10 p-2 text-white"><Maximize2 className="h-5 w-5" /></button>
          <button aria-label="Close" onClick={() => store.getState().closeOverlays()} className="rounded bg-white/10 p-2 text-white"><X className="h-5 w-5" /></button>
        </div>
      )}
    </div>
  );
}
