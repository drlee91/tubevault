import Link from "next/link";
import { JobStatusPill } from "@/components/shared/job-status-pill";
import { RelativeTime } from "@/components/shared/relative-time";
import { EmptyState } from "@/components/shared/empty-state";
import { Activity } from "lucide-react";

interface Item {
  id: number;
  playlistId: number;
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
      {items.map((it) => (
        <Link
          key={it.id}
          href={`/playlists/${it.playlistId}`}
          className="flex items-center gap-3 rounded-md border border-[var(--color-border)] p-3 hover:bg-[var(--color-muted-bg)]"
        >
          <JobStatusPill
            status={
              it.status === "running"
                ? "running"
                : it.status === "failed"
                  ? "failed"
                  : "completed"
            }
          />
          <span className="flex-1 text-sm">
            {it.playlistTitle}
            <span className="ml-2 text-[var(--color-muted)]">
              +{it.videosAdded} −{it.videosRemoved} ⛔{it.videosUnavailable}
            </span>
          </span>
          <span className="text-xs text-[var(--color-muted)]">
            <RelativeTime iso={it.finishedAt} />
          </span>
        </Link>
      ))}
    </div>
  );
}
