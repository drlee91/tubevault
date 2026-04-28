"use client";
import useSWR from "swr";
import { fetcher } from "./fetcher";
import type { VideoRow } from "@/lib/db/repositories/video-repo";

export type VideoSerialized = Omit<
  VideoRow,
  "availabilityChangedAt" | "firstSeenAt" | "lastSeenAt" | "createdAt" | "updatedAt"
> & {
  availabilityChangedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
  availableKinds: Array<"audio" | "video">;
};

export function useStandaloneVideos(opts: { intervalMs?: number } = {}) {
  return useSWR<{ videos: VideoSerialized[] }>("/api/videos", fetcher, {
    refreshInterval: opts.intervalMs ?? 15_000,
    refreshWhenHidden: false,
  });
}
