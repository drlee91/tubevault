"use client";

import { useStorageUsage } from "@/lib/client/use-storage-usage";
import { FormattedBytes } from "@/components/shared/formatted-bytes";
import { SkeletonRow } from "@/components/shared/skeleton-row";

export function StorageUsageDisplay() {
  const { data, isLoading } = useStorageUsage();
  if (isLoading || !data) return <SkeletonRow count={2} />;
  return (
    <div className="space-y-3 rounded-md border border-[var(--color-line)] p-4">
      <h3 className="text-sm font-medium">Disk Usage</h3>
      <div className="space-y-2">
        <UsageRow label="Audio" bytes={data.audio.totalBytes} files={data.audio.fileCount} />
        <UsageRow label="Video" bytes={data.video.totalBytes} files={data.video.fileCount} />
      </div>
    </div>
  );
}

function UsageRow({ label, bytes, files }: { label: string; bytes: number; files: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 text-xs text-[var(--color-fg-muted)]">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-muted-bg)]">
        <div className="h-full bg-[var(--color-brand)]" style={{ width: bytes > 0 ? "100%" : "0%" }} />
      </div>
      <span className="text-xs tabular-nums text-[var(--color-fg-muted)]">
        <FormattedBytes bytes={bytes} /> · {files} files
      </span>
    </div>
  );
}
