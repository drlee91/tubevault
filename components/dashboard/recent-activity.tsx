import Link from "next/link";
import { RelativeTime } from "@/components/shared/relative-time";
import { EmptyState } from "@/components/shared/empty-state";
import { Activity, Check, Loader2, X } from "lucide-react";

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

function StatusIcon({ status }: { status: Item["status"] }) {
  switch (status) {
    case "success":
    case "partial":
      return <Check className="h-4 w-4 shrink-0 text-[var(--color-ok)]" aria-hidden />;
    case "failed":
      return <X className="h-4 w-4 shrink-0 text-[var(--color-danger)]" aria-hidden />;
    case "running":
      return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--color-fg-muted)]" aria-hidden />;
    default:
      return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-fg-muted)]" aria-hidden />;
  }
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
    <div>
      {items.map((it) => {
        const body = (
          <>
            <StatusIcon status={it.status} />
            <span className="flex-1 truncate text-sm">{it.playlistTitle}</span>
            <span className="text-xs text-[var(--color-fg-muted)]">
              +{it.videosAdded} · −{it.videosRemoved}
            </span>
            <span className="text-xs text-[var(--color-fg-muted)]">
              <RelativeTime iso={it.finishedAt} />
            </span>
          </>
        );
        const baseClass =
          "flex items-center gap-3 rounded-lg px-3 py-2";
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
