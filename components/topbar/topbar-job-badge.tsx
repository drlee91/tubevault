"use client";

import Link from "next/link";
import { useJobSummary } from "@/lib/client/use-job-summary";

export function TopbarJobBadge() {
  const { data } = useJobSummary();
  if (!data) return null;
  const active = data.queued + data.running;
  if (active === 0 && data.failed === 0) return null;
  return (
    <Link
      href="/activity?tab=jobs"
      className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs hover:bg-[var(--color-muted-bg)]"
      aria-label="Active jobs"
    >
      {active > 0 && (
        <>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-accent)] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-accent)]" />
          </span>
          <span>{active} active</span>
        </>
      )}
      {data.failed > 0 && (
        <span className="text-[var(--color-status-removed)]">{data.failed} failed</span>
      )}
    </Link>
  );
}
