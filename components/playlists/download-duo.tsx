"use client";

import { useState, useEffect, useTransition } from "react";
import { Music, Film, Loader2, AlertCircle, ArrowDownToLine } from "lucide-react";
import { toast } from "sonner";
import { downloadVideoAction } from "@/lib/actions/video-actions";
import { retryJobAction } from "@/lib/actions/job-actions";
import { cn } from "@/lib/utils";

export type DuoSlot =
  | { state: "present"; format: string; sizeBytes?: number }
  | { state: "missing" }
  | { state: "pending"; status: "queued" | "running" }
  | { state: "failed"; jobId: number };

interface Props {
  videoId: number;
  /** false only for statuses known to be undownloadable */
  canDownload: boolean;
  audio: DuoSlot;
  video: DuoSlot;
  onMutate?: () => void;
}

function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return i === 0 ? `${n} ${units[i]}` : `${n.toFixed(1)} ${units[i]}`;
}

interface SlotProps {
  kind: "audio" | "video";
  slot: DuoSlot;
  videoId: number;
  canDownload: boolean;
  onMutate?: () => void;
}

function Slot({ kind, slot, videoId, canDownload, onMutate }: SlotProps) {
  const [pending, start] = useTransition();
  const [optimistic, setOptimistic] = useState(false);
  const Icon = kind === "audio" ? Music : Film;
  const label = kind === "audio" ? "Audio" : "Video";

  // Clear optimism whenever fresh data moves the slot off its previous state
  useEffect(() => {
    setOptimistic(false);
  }, [slot.state]);

  if (slot.state === "present") {
    return (
      <span
        className="inline-flex text-[var(--color-ok)]"
        aria-label={`${kind} downloaded (${slot.format})`}
        title={`${label} · ${slot.format}${slot.sizeBytes ? ` · ${formatBytes(slot.sizeBytes)}` : ""}`}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>
    );
  }

  if (slot.state === "pending" || pending || optimistic) {
    const status = slot.state === "pending" ? slot.status : "queued";
    return (
      <span
        className="inline-flex"
        aria-label={`${kind} download ${status}`}
        title={`${label} download ${status}`}
      >
        <Loader2 className="h-4 w-4 animate-spin text-[var(--color-fg-muted)]" aria-hidden />
      </span>
    );
  }

  if (slot.state === "failed") {
    return (
      <button
        type="button"
        aria-label={`retry ${kind} download`}
        title={`${label} download failed — click to retry`}
        onClick={() => {
          setOptimistic(true);
          start(async () => {
            const r = await retryJobAction(slot.jobId);
            if (!r.ok) {
              setOptimistic(false);
              toast.error("Retry failed", { description: r.error.message });
            } else {
              onMutate?.();
            }
          });
        }}
        className="inline-flex rounded p-0.5 text-[var(--color-danger)] hover:bg-[var(--color-muted-bg)]"
      >
        <AlertCircle className="h-4 w-4" aria-hidden />
      </button>
    );
  }

  // state === "missing"
  return (
    <button
      type="button"
      aria-label={`download ${kind}`}
      title={canDownload ? `Download ${label.toLowerCase()}` : "Not downloadable"}
      disabled={!canDownload}
      onClick={() => {
        setOptimistic(true);
        start(async () => {
          const r = await downloadVideoAction(videoId, kind);
          if (!r.ok) {
            setOptimistic(false);
            toast.error("Download failed", { description: r.error.message });
          } else {
            onMutate?.();
          }
        });
      }}
      className={cn(
        "group/slot inline-flex rounded p-0.5 text-[var(--color-faint)]",
        canDownload && "hover:bg-[var(--color-muted-bg)] hover:text-[var(--color-fg)]",
        !canDownload && "opacity-40",
      )}
    >
      <Icon className="h-4 w-4 group-hover/slot:hidden" aria-hidden />
      <ArrowDownToLine className="hidden h-4 w-4 group-hover/slot:block" aria-hidden />
    </button>
  );
}

export function DownloadDuo(props: Props) {
  return (
    <div className="flex w-14 shrink-0 items-center justify-end gap-1.5">
      <Slot kind="audio" slot={props.audio} videoId={props.videoId} canDownload={props.canDownload} onMutate={props.onMutate} />
      <Slot kind="video" slot={props.video} videoId={props.videoId} canDownload={props.canDownload} onMutate={props.onMutate} />
    </div>
  );
}
