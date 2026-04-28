"use client";
import useSWR from "swr";
import { fetcher } from "./fetcher";
import type { JobSummary } from "@/lib/services/job-service";

export function useJobSummary(opts: { intervalMs?: number } = {}) {
  return useSWR<JobSummary>("/api/jobs/summary", fetcher, {
    refreshInterval: opts.intervalMs ?? 30_000,
    refreshWhenHidden: false,
  });
}
