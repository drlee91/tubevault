"use client";
import useSWR from "swr";
import { fetcher } from "./fetcher";

export function useStorageUsage() {
  return useSWR<{
    audio: { totalBytes: number; fileCount: number };
    video: { totalBytes: number; fileCount: number };
  }>("/api/storage/usage", fetcher, { revalidateOnFocus: false });
}
