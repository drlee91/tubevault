"use client";

import { MoreVertical, ExternalLink, Download, RefreshCw, Play, PlusCircle, ListPlus } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { downloadVideoAction, refreshVideoAction } from "@/lib/actions/video-actions";
import { usePlayerStoreApiOptional } from "@/lib/client/use-player-store";
import type { QueueItem } from "@/lib/player/types";

interface Props {
  videoId: number;
  externalUrl: string;
  /** False only for statuses known to be undownloadable (removed, private, …). */
  canDownload: boolean;
  /** Kinds that already have a media file on disk — switches the menu label between Download and Re-download. */
  downloadedKinds?: Array<"audio" | "video">;
  queueItem?: QueueItem;
}

export function TrackContextMenu({ videoId, externalUrl, canDownload, downloadedKinds = [], queueItem }: Props) {
  const [, start] = useTransition();
  const store = usePlayerStoreApiOptional();

  function dl(kind: "audio" | "video") {
    start(async () => {
      const result = await downloadVideoAction(videoId, kind);
      if (result.ok) {
        toast.success(`Download (${kind}) queued`);
      } else {
        toast.error("Download failed", { description: result.error.message });
      }
    });
  }

  const dlLabel = (kind: "audio" | "video") =>
    `${downloadedKinds.includes(kind) ? "Re-download" : "Download"} as ${kind === "audio" ? "Audio" : "Video"}`;

  function refresh() {
    start(async () => {
      const result = await refreshVideoAction(videoId);
      if (result.ok) {
        toast.success("Refresh queued");
      } else {
        toast.error("Refresh failed", { description: result.error.message });
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Track actions"
        render={
          <button
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "h-8 w-8 p-0",
            )}
          />
        }
      >
        <MoreVertical className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {queueItem && store && (
          <>
            <DropdownMenuItem
              onClick={() => {
                store.getState().setQueue([queueItem], 0);
                store.getState().play();
              }}
            >
              <Play className="mr-2 h-4 w-4" /> Play Now
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => store.getState().addToQueue(queueItem)}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add to Queue
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => store.getState().playNext(queueItem)}>
              <ListPlus className="mr-2 h-4 w-4" /> Play Next
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem
          render={<a href={externalUrl} target="_blank" rel="noreferrer" />}
        >
          <ExternalLink className="mr-2 h-4 w-4" /> Open on YouTube
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!canDownload} onClick={() => dl("audio")}>
          <Download className="mr-2 h-4 w-4" /> {dlLabel("audio")}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!canDownload} onClick={() => dl("video")}>
          <Download className="mr-2 h-4 w-4" /> {dlLabel("video")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={refresh}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh availability
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
