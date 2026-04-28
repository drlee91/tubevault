import type { ComponentProps } from "react";
import { RefreshCw, Download, Search, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type JobType = "sync_playlist" | "download_video" | "check_availability";

const map: Record<JobType, { label: string; icon: LucideIcon }> = {
  sync_playlist: { label: "sync", icon: RefreshCw },
  download_video: { label: "download", icon: Download },
  check_availability: { label: "check", icon: Search },
};

interface Props extends ComponentProps<"span"> {
  type: JobType;
}

export function JobTypeBadge({ type, className, ...rest }: Props) {
  const { label, icon: Icon } = map[type];
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-muted-bg)] px-2 text-xs",
        className,
      )}
      {...rest}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}
