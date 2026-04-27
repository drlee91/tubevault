"use client";

import { useState } from "react";
import Link from "next/link";
import { JobStatusPill } from "@/components/shared/job-status-pill";
import { RelativeTime } from "@/components/shared/relative-time";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { JobStatus } from "@/components/shared/job-status-pill";

export interface SyncRunRow {
  id: number;
  playlistId: number;
  playlistTitle: string;
  status: "running" | "success" | "partial" | "failed";
  videosAdded: number;
  videosRemoved: number;
  videosUnavailable: number;
  videosDownloaded: number;
  startedAt: string;
  finishedAt: string | null;
  triggeredBy: string;
  errorLog: unknown;
}

const statusToPill: Record<SyncRunRow["status"], JobStatus> = {
  running: "running",
  success: "completed",
  partial: "partial",
  failed: "failed",
};

export function HistoryRow({ run }: { run: SyncRunRow }) {
  const [open, setOpen] = useState(false);
  const errorLog = Array.isArray(run.errorLog) ? (run.errorLog as unknown[]) : null;
  const hasErrors = errorLog !== null && errorLog.length > 0;

  function toggle() {
    setOpen((o) => !o);
  }

  return (
    <div className="rounded-md border border-[var(--color-border)]">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") toggle();
        }}
        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[var(--color-muted-bg)] cursor-pointer"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" />
        )}
        <JobStatusPill status={statusToPill[run.status]} />
        <Link
          href={`/playlists/${run.playlistId}`}
          onClick={(e) => e.stopPropagation()}
          className="text-sm hover:underline"
        >
          {run.playlistTitle}
        </Link>
        <span className="text-xs text-[var(--color-muted)]">
          +{run.videosAdded} −{run.videosRemoved} ⛔{run.videosUnavailable} ⬇{run.videosDownloaded}
        </span>
        <span className="ml-auto text-xs text-[var(--color-muted)]">
          <RelativeTime iso={run.finishedAt ?? run.startedAt} /> · {run.triggeredBy}
        </span>
      </div>
      {open && hasErrors && (
        <pre className="overflow-auto border-t border-[var(--color-border)] bg-[var(--color-muted-bg)] p-3 font-mono text-xs">
          {JSON.stringify(errorLog, null, 2)}
        </pre>
      )}
    </div>
  );
}
