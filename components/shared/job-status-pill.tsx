import type { ComponentProps } from "react";
import {
  Clock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type JobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "partial";

const map: Record<JobStatus, { label: string; icon: LucideIcon; classes: string; spin?: boolean }> = {
  queued: {
    label: "queued",
    icon: Clock,
    classes: "bg-[var(--color-muted-bg)] text-[var(--color-fg-muted)]",
  },
  running: {
    label: "running",
    icon: Loader2,
    classes: "bg-[var(--color-muted-bg)] text-[var(--color-fg-muted)]",
    spin: true,
  },
  completed: {
    label: "completed",
    icon: CheckCircle2,
    classes:
      "bg-[var(--color-status-bg-available)] text-[var(--color-status-available)]",
  },
  failed: {
    label: "failed",
    icon: AlertCircle,
    classes: "bg-[var(--color-status-bg-removed)] text-[var(--color-status-removed)]",
  },
  cancelled: {
    label: "cancelled",
    icon: XCircle,
    classes: "bg-[var(--color-muted-bg)] text-[var(--color-fg-muted)]",
  },
  partial: {
    label: "partial",
    icon: AlertTriangle,
    classes: "bg-[var(--color-status-bg-private)] text-[var(--color-status-private)]",
  },
};

interface Props extends ComponentProps<"span"> {
  status: JobStatus;
}

export function JobStatusPill({ status, className, ...rest }: Props) {
  const { label, icon: Icon, classes, spin } = map[status];
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-md px-2 text-xs font-medium tracking-tight lowercase",
        classes,
        className,
      )}
      {...rest}
    >
      <Icon className={cn("h-3 w-3", spin && "animate-spin")} aria-hidden />
      {label}
    </span>
  );
}
