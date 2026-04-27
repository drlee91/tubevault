"use client";
import useSWR from "swr";
import { fetcher } from "./fetcher";
import type { PlaylistDetailDto } from "@/lib/services/playlist-service";

export function usePlaylistDetail(
  id: number,
  opts: { intervalMs?: number; fallbackData?: PlaylistDetailDto } = {},
) {
  return useSWR<PlaylistDetailDto>(`/api/playlists/${id}`, fetcher, {
    refreshInterval: opts.intervalMs ?? 5_000,
    revalidateOnFocus: true,
    refreshWhenHidden: false,
    fallbackData: opts.fallbackData,
  });
}
