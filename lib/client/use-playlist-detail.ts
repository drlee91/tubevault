"use client";
import useSWR from "swr";
import { fetcher } from "./fetcher";
import type { PlaylistDetailDto } from "@/lib/services/playlist-service";

// PlaylistDetailDto is already wire-shaped: every Date field is serialized to a
// string at the service-layer boundary. We re-export under the *Serialized
// suffix so the SWR-side convention stays consistent with VideoSerialized.
export type PlaylistDetailSerialized = PlaylistDetailDto;

export function usePlaylistDetail(
  id: number,
  opts: { intervalMs?: number; fallbackData?: PlaylistDetailSerialized } = {},
) {
  return useSWR<PlaylistDetailSerialized>(`/api/playlists/${id}`, fetcher, {
    refreshInterval: opts.intervalMs ?? 5_000,
    revalidateOnFocus: true,
    refreshWhenHidden: false,
    fallbackData: opts.fallbackData,
  });
}
