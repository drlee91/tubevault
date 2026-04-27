"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useJobs } from "@/lib/client/use-jobs";
import { JobRow } from "./job-row";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorCard } from "@/components/shared/error-card";
import { SkeletonRow } from "@/components/shared/skeleton-row";
import { ListChecks } from "lucide-react";

const FILTERS = ["all", "running", "queued", "failed", "completed"] as const;

export function JobsTab() {
  const sp = useSearchParams();
  const router = useRouter();
  const filter = (sp.get("status") ?? "all") as (typeof FILTERS)[number];
  const status = filter === "all" ? undefined : filter;
  const { data, error, mutate, isLoading } = useJobs({ status });

  function setFilter(f: (typeof FILTERS)[number]) {
    const next = new URLSearchParams(sp.toString());
    next.delete("tab");
    if (f === "all") next.delete("status"); else next.set("status", f);
    router.replace(`/activity?tab=jobs${next.toString() ? "&" + next.toString() : ""}`);
  }

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Filter jobs by status" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1 text-xs ${
              filter === f
                ? "bg-[var(--color-fg)] text-[var(--color-bg)]"
                : "bg-[var(--color-muted-bg)] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      {error && <ErrorCard title="Couldn't load jobs" onRetry={() => mutate()} />}
      {isLoading && !data && <SkeletonRow count={5} />}
      {data && data.jobs.length === 0 && (
        <EmptyState icon={ListChecks} title="No jobs match." />
      )}
      {data && data.jobs.length > 0 && (
        <div className="space-y-2">
          {data.jobs.map((j) => <JobRow key={j.id} job={j} onMutate={() => mutate()} />)}
        </div>
      )}
    </div>
  );
}
