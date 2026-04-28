"use client";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { usePlayerStore, usePlayerStoreApi } from "@/lib/client/use-player-store";
import { QueueList } from "./queue-list";

export function QueueDrawer() {
  const store = usePlayerStoreApi();
  const open = usePlayerStore((s) => s.mode === "queue-open");
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) store.getState().closeOverlays(); }}>
      <SheetContent side="right" className="w-[360px] p-0">
        <QueueList />
      </SheetContent>
    </Sheet>
  );
}
