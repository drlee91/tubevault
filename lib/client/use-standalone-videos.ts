"use client";
import useSWR from "swr";
import { fetcher } from "./fetcher";
import type { VideoRow } from "@/lib/db/repositories/video-repo";

export function useStandaloneVideos(opts: { intervalMs?: number } = {}) {
  return useSWR<{ videos: VideoRow[] }>("/api/videos", fetcher, {
    refreshInterval: opts.intervalMs ?? 15_000,
    refreshWhenHidden: false,
  });
}
