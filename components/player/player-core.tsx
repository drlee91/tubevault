"use client";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { usePlayerStore, usePlayerStoreApi } from "@/lib/client/use-player-store";

interface Props {
  resolveMediaFileId: (videoId: number, kind: "audio" | "video") => number | null;
}

export function PlayerCore({ resolveMediaFileId }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const store = usePlayerStoreApi();
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const currentKind = usePlayerStore((s) => s.currentKind);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const queue = usePlayerStore((s) => s.queue);
  const mode = usePlayerStore((s) => s.mode);

  useEffect(() => {
    const item = currentIndex >= 0 ? queue[currentIndex] : null;
    if (!item || !currentKind) {
      if (audioRef.current) audioRef.current.removeAttribute("src");
      if (videoRef.current) videoRef.current.removeAttribute("src");
      return;
    }
    const id = resolveMediaFileId(item.videoId, currentKind);
    if (id == null) {
      toast.error(`Couldn't play '${item.title}' — file missing. Skipped.`);
      store.getState().markBrokenAndAdvance();
      return;
    }
    const url = `/api/stream/${id}`;
    const el = currentKind === "audio" ? audioRef.current : videoRef.current;
    if (el && el.getAttribute("src") !== url) el.setAttribute("src", url);
  }, [currentIndex, currentKind, queue, resolveMediaFileId, store]);

  useEffect(() => {
    const el = currentKind === "audio" ? audioRef.current : videoRef.current;
    if (!el) return;
    if (isPlaying) void el.play().catch(() => store.getState().pause());
    else el.pause();
  }, [isPlaying, currentKind, currentIndex, store]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    if (videoRef.current) videoRef.current.volume = volume;
  }, [volume]);

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

  const showVideo = currentKind === "video" && (mode === "fullscreen" || mode === "queue-open");
  return (
    <>
      <audio ref={audioRef} preload="metadata" hidden />
      <video
        ref={videoRef}
        preload="metadata"
        playsInline
        className={showVideo ? "h-full w-full" : "hidden"}
      />
    </>
  );
}
