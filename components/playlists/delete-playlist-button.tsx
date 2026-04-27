"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { deletePlaylistAction } from "@/lib/actions/playlist-actions";

export function DeletePlaylistButton({ playlistId }: { playlistId: number }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  function onConfirm() {
    start(async () => {
      const r = await deletePlaylistAction(playlistId);
      if (!r.ok) { toast.error("Delete failed", { description: r.error.message }); return; }
      toast.success("Playlist deleted");
      router.push("/playlists");
    });
  }
  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm" variant="ghost" className="gap-2 text-[var(--color-status-removed)]">
        <Trash2 className="h-4 w-4" /> Delete
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete playlist?</DialogTitle></DialogHeader>
          <DialogDescription>
            This removes the playlist and its item links. Downloaded files and video metadata are kept.
          </DialogDescription>
          <DialogFooter>
            <Button variant="ghost" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={onConfirm}
              disabled={pending}
              className="bg-[var(--color-status-removed)] text-white hover:bg-[var(--color-status-removed)]/90"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
