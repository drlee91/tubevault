"use client";
import { JobStatusPill } from "@/components/shared/job-status-pill";
import { JobTypeBadge } from "@/components/shared/job-type-badge";
import { RelativeTime } from "@/components/shared/relative-time";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RetryJobButton } from "./retry-job-button";
import type { JobsListItem } from "@/lib/services/job-service";
import type { JobType } from "@/components/shared/job-type-badge";
import type { JobStatus as JobStatusPillStatus } from "@/components/shared/job-status-pill";

export function JobRow({ job, onMutate }: { job: JobsListItem; onMutate: () => void }) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto_auto_auto_1fr_auto] items-center gap-3 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm">
      <JobTypeBadge type={job.type as JobType} />
      <span className="truncate">{job.subject?.title ?? <span className="text-[var(--color-muted)]">—</span>}</span>
      <JobStatusPill status={job.status as JobStatusPillStatus} />
      <span className="text-xs text-[var(--color-muted)] tabular-nums">{job.attempts}/{job.maxAttempts}</span>
      <span className="text-xs text-[var(--color-muted)]"><RelativeTime iso={job.startedAt} /></span>
      <span className="truncate text-xs text-[var(--color-muted)]">
        {job.lastError ? (
          <Tooltip>
            <TooltipTrigger className="cursor-help underline">{job.lastError.slice(0, 60)}</TooltipTrigger>
            <TooltipContent className="max-w-md whitespace-pre-wrap">{job.lastError}</TooltipContent>
          </Tooltip>
        ) : null}
      </span>
      <span className="text-right">
        {job.status === "failed" && <RetryJobButton jobId={job.id} onRetried={onMutate} />}
        {job.status === "running" && (
          <Tooltip>
            <TooltipTrigger
              render={<button type="button" disabled className="text-xs text-[var(--color-muted)] underline-offset-2 hover:underline disabled:opacity-50" />}
            >
              Cancel
            </TooltipTrigger>
            <TooltipContent>Cancel coming soon</TooltipContent>
          </Tooltip>
        )}
      </span>
    </div>
  );
}
