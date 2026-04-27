import Link from "next/link";
import { JobStatusPill } from "@/components/shared/job-status-pill";
import { RelativeTime } from "@/components/shared/relative-time";
import { EmptyState } from "@/components/shared/empty-state";
import { Activity } from "lucide-react";

interface Item {
  id: number;
  playlistId: number | null;
  playlistTitle: string;
  status: "running" | "success" | "partial" | "failed";
  videosAdded: number;
  videosRemoved: number;
  videosUnavailable: number;
  finishedAt: string | null;
  triggeredBy: string;
}

interface Props {
  items: Item[];
}

const pillStatus = {
  running: "running",
  failed: "failed",
  partial: "partial",
  success: "completed",
} as const;

export function RecentActivity({ items }: Props) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No syncs yet"
        description="Add a playlist to start."
      />
    );
  }
  return (
    <div className="space-y-2">
      {items.map((it) => {
        const body = (
          <>
            <JobStatusPill status={pillStatus[it.status]} />
            <span className="flex-1 text-sm">
              {it.playlistTitle}
              <span className="ml-2 text-[var(--color-muted)]">
                +{it.videosAdded} −{it.videosRemoved} ⛔{it.videosUnavailable}
              </span>
            </span>
            <span className="text-xs text-[var(--color-muted)]">
              <RelativeTime iso={it.finishedAt} />
            </span>
          </>
        );
        const baseClass =
          "flex items-center gap-3 rounded-md border border-[var(--color-border)] p-3";
        return it.playlistId != null ? (
          <Link
            key={it.id}
            href={`/playlists/${it.playlistId}`}
            className={`${baseClass} hover:bg-[var(--color-muted-bg)]`}
          >
            {body}
          </Link>
        ) : (
          <div key={it.id} className={`${baseClass} opacity-70`}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
