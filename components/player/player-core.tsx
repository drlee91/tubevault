"use client";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { usePlayerStore, usePlayerStoreApi } from "@/lib/client/use-player-store";

interface Props {
  /**
   * Resolve the media-file id for a given video + kind.
   * - `number`    → id known, set src
   * - `null`      → definitively not found (skip track)
   * - `undefined` → not yet in cache; caller is fetching, re-render expected
   */
  resolveMediaFileId: (videoId: number, kind: "audio" | "video") => number | null | undefined;
  /** Incremented by PlayerProvider each time the media-file cache gains new entries. Forces re-run of the src effect. */
  cacheVersion?: number;
}

export function PlayerCore({ resolveMediaFileId, cacheVersion = 0 }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const store = usePlayerStoreApi();
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const currentKind = usePlayerStore((s) => s.currentKind);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const queue = usePlayerStore((s) => s.queue);
  const mode = usePlayerStore((s) => s.mode);
  const seekToken = usePlayerStore((s) => s.seekToken);

  // play() that tolerates load interruptions: an AbortError only means the
  // src changed mid-play (auto-advance, cache fetch landing) and a follow-up
  // play() for the new source is on its way. Treating it as "playback failed"
  // used to flip isPlaying off and silently stop the queue.
  const safePlay = useCallback(
    (el: HTMLMediaElement) => {
      void el.play().catch((err: unknown) => {
        if ((err as DOMException)?.name !== "AbortError") store.getState().pause();
      });
    },
    [store],
  );

  useEffect(() => {
    const item = currentIndex >= 0 ? queue[currentIndex] : null;
    if (!item || !currentKind) {
      if (audioRef.current) audioRef.current.removeAttribute("src");
      if (videoRef.current) videoRef.current.removeAttribute("src");
      return;
    }
    const id = resolveMediaFileId(item.videoId, currentKind);
    if (id === undefined) {
      // Cache miss — fetch is in-flight; wait for re-render after fetch completes.
      return;
    }
    if (id === null) {
      toast.error(`Couldn't play '${item.title}' — file missing. Skipped.`);
      store.getState().markBrokenAndAdvance();
      return;
    }
    const url = `/api/stream/${id}`;
    const el = currentKind === "audio" ? audioRef.current : videoRef.current;
    // A kind switch (audio↔video) leaves the previous element loaded and
    // possibly playing; stop it so two sources never run on top of each other.
    const inactive = currentKind === "audio" ? videoRef.current : audioRef.current;
    if (inactive && !inactive.paused) inactive.pause();
    if (el && el.getAttribute("src") !== url) {
      el.setAttribute("src", url);
      // The play effect doesn't depend on src/cacheVersion, so when only the
      // src changed (auto-advance resolving after a cache fetch) nothing else
      // restarts playback — and the load just aborted any pending play().
      if (store.getState().isPlaying) safePlay(el);
    }
  }, [currentIndex, currentKind, queue, resolveMediaFileId, store, cacheVersion, safePlay]);

  useEffect(() => {
    const el = currentKind === "audio" ? audioRef.current : videoRef.current;
    if (!el) return;
    if (isPlaying) safePlay(el);
    else el.pause();
  }, [isPlaying, currentKind, currentIndex, store, safePlay]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    if (videoRef.current) videoRef.current.volume = volume;
  }, [volume]);

  // Apply user-initiated seeks to the active media element. Bumped seekToken
  // signals the intent — `position` reads also bump on every timeupdate, so
  // we react to the token, not the position, to avoid an echo loop.
  useEffect(() => {
    if (seekToken === 0) return;
    const el = currentKind === "audio" ? audioRef.current : videoRef.current;
    if (!el) return;
    const target = store.getState().position;
    if (Math.abs(el.currentTime - target) > 0.25) el.currentTime = target;
  }, [seekToken, currentKind, store]);

  useEffect(() => {
    function bind(el: HTMLMediaElement | null) {
      if (!el) return () => {};
      const onLoaded = () => store.getState().setDuration(el.duration);
      let last = 0;
      const onTime = () => {
        const now = performance.now();
        if (now - last < 250) return;
        last = now;
        store.getState().setPosition(el.currentTime);
      };
      const onEnded = () => store.getState().next();
      const onError = () => {
        const item = store.getState().queue[store.getState().currentIndex];
        toast.error(`Couldn't play '${item?.title ?? "track"}' — file missing. Skipped.`);
        store.getState().markBrokenAndAdvance();
      };
      el.addEventListener("loadedmetadata", onLoaded);
      el.addEventListener("timeupdate", onTime);
      el.addEventListener("ended", onEnded);
      el.addEventListener("error", onError);
      return () => {
        el.removeEventListener("loadedmetadata", onLoaded);
        el.removeEventListener("timeupdate", onTime);
        el.removeEventListener("ended", onEnded);
        el.removeEventListener("error", onError);
      };
    }
    const a = bind(audioRef.current);
    const v = bind(videoRef.current);
    return () => { a(); v(); };
  }, [store]);

  const showVideo = currentKind === "video" && mode === "fullscreen";
  return (
    <>
      <audio ref={audioRef} preload="metadata" hidden />
      {/* Always-mounted video: parent toggles between hidden and a fixed
          fullscreen overlay so playback continuity is preserved when the user
          enters/leaves fullscreen. The element itself stays attached to the
          same React node — toggling visibility, not remount. */}
      <div
        className={
          showVideo
            ? "fixed inset-0 z-30 grid place-items-center bg-black pb-16"
            : "hidden"
        }
      >
        <video
          ref={videoRef}
          preload="metadata"
          playsInline
          controls
          className="max-h-full max-w-full"
        />
      </div>
    </>
  );
}
