"use client";
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { JobStatusPill } from "@/components/shared/job-status-pill";
import { JobTypeBadge } from "@/components/shared/job-type-badge";
import { RelativeTime } from "@/components/shared/relative-time";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RetryJobButton } from "./retry-job-button";
import type { JobsListItem } from "@/lib/services/job-service";
import type { JobType } from "@/components/shared/job-type-badge";
import type { JobStatus as JobStatusPillStatus } from "@/components/shared/job-status-pill";

export function JobRow({ job, onMutate }: { job: JobsListItem; onMutate: () => void }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const hasError = Boolean(job.lastError);

  async function copyError() {
    if (!job.lastError) return;
    try {
      await navigator.clipboard.writeText(job.lastError);
      setCopied(true);
      toast.success("Error copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy");
    }
  }

  return (
    <div className="rounded-md border border-[var(--color-border)] text-sm">
      <div className="grid grid-cols-[auto_1fr_auto_auto_auto_1fr_auto] items-center gap-3 px-3 py-2">
        <JobTypeBadge type={job.type as JobType} />
        <span className="truncate">{job.subject?.title ?? <span className="text-[var(--color-muted)]">—</span>}</span>
        <JobStatusPill status={job.status as JobStatusPillStatus} />
        <span className="text-xs text-[var(--color-muted)] tabular-nums">{job.attempts}/{job.maxAttempts}</span>
        <span className="text-xs text-[var(--color-muted)]"><RelativeTime iso={job.startedAt} /></span>
        <span className="min-w-0 text-xs text-[var(--color-muted)]">
          {hasError ? (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              title={open ? "Hide details" : "Show full error"}
              className="block w-full truncate text-left underline underline-offset-2 hover:text-[var(--color-fg)]"
            >
              {job.lastError}
            </button>
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
      {open && hasError && (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-muted-bg)]">
          <div className="flex items-center justify-between gap-3 px-3 py-1.5">
            <span className="text-xs text-[var(--color-muted)]">Error details</span>
            <button
              type="button"
              onClick={copyError}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-fg)]"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words border-t border-[var(--color-border)] px-3 py-2 font-mono text-xs">
            {job.lastError}
          </pre>
        </div>
      )}
    </div>
  );
}
