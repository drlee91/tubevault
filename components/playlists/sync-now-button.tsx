"use client";
import { RefreshCw } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { syncPlaylistAction } from "@/lib/actions/playlist-actions";

export function SyncNowButton({ playlistId, disabled }: { playlistId: number; disabled?: boolean }) {
  const [pending, start] = useTransition();
  function onClick() {
    start(async () => {
      const r = await syncPlaylistAction(playlistId);
      if (!r.ok) toast.error("Sync failed", { description: r.error.message });
      else toast.success("Sync queued");
    });
  }
  return (
    <Button onClick={onClick} disabled={disabled || pending} size="sm" variant="outline" className="gap-2">
      <RefreshCw className={pending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
      Sync now
    </Button>
  );
}
