"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useJobSummary } from "@/lib/client/use-job-summary";

export function TopbarJobBadge() {
  const { data } = useJobSummary();
  if (!data) return null;
  const active = data.queued + data.running;
  if (active === 0 && data.failed === 0) return null;
  return (
    <Link
      href="/activity?tab=jobs"
      aria-label="Active jobs"
      className="inline-flex items-center gap-1.5 rounded p-1.5 hover:bg-[var(--color-muted-bg)]"
    >
      {active > 0 && (
        <Loader2 className="h-4 w-4 animate-spin text-[var(--color-fg-muted)]" />
      )}
      {data.failed > 0 && (
        <span className="rounded-full bg-[var(--color-danger)] px-1.5 text-xs font-medium text-[var(--color-brand-fg)]">
          {data.failed}
          <span className="sr-only"> failed jobs</span>
        </span>
      )}
    </Link>
  );
}
