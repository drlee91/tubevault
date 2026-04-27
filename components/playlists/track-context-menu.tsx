"use client";

import { MoreVertical, ExternalLink, Download, RefreshCw } from "lucide-react";
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

interface Props {
  videoId: number;
  externalUrl: string;
  available: boolean;
}

export function TrackContextMenu({ videoId, externalUrl, available }: Props) {
  const [, start] = useTransition();

  function dl(kind: "audio" | "video") {
    start(async () => {
      const result = await downloadVideoAction(videoId, kind);
      if (result.ok) {
        toast.success(`Re-download (${kind}) queued`);
      } else {
        toast.error("Download failed", { description: result.error.message });
      }
    });
  }

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
        <DropdownMenuItem
          render={<a href={externalUrl} target="_blank" rel="noreferrer" />}
        >
          <ExternalLink className="mr-2 h-4 w-4" /> Open on YouTube
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!available} onClick={() => dl("audio")}>
          <Download className="mr-2 h-4 w-4" /> Re-download as Audio
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!available} onClick={() => dl("video")}>
          <Download className="mr-2 h-4 w-4" /> Re-download as Video
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={refresh}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh availability
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
