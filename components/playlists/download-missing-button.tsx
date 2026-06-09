"use client";
import { Download } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadMissingAction } from "@/lib/actions/playlist-actions";

export function DownloadMissingButton({
  playlistId,
}: {
  playlistId: number;
}) {
  const [pending, start] = useTransition();
  function onClick() {
    start(async () => {
      const r = await downloadMissingAction(playlistId);
      if (!r.ok) {
        toast.error("Download failed", { description: r.error.message });
      } else if (r.data.queued === 0) {
        toast.info("Nothing to queue — missing files are already downloading or complete");
      } else {
        toast.success(`${r.data.queued} downloads queued`);
      }
    });
  }
  return (
    <Button
      onClick={onClick}
      disabled={pending}
      size="sm"
      variant="outline"
      className="gap-2"
      title="Queue audio + video downloads for every item with missing files"
    >
      <Download className={pending ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
      Download missing
    </Button>
  );
}
