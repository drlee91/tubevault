"use client";
import useSWR from "swr";
import { fetcher } from "./fetcher";
import type { JobsList } from "@/lib/services/job-service";

export function useJobs(p: { status?: string; limit?: number; intervalMs?: number } = {}) {
  const params = new URLSearchParams();
  if (p.status) params.set("status", p.status);
  params.set("limit", String(p.limit ?? 50));
  return useSWR<JobsList>(`/api/jobs?${params}`, fetcher, {
    refreshInterval: p.intervalMs ?? 10_000,
    refreshWhenHidden: false,
  });
}
