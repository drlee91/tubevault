"use client";
import { QueueList } from "./queue-list";

export function QueueSidebar() {
  return (
    <aside className="hidden w-[320px] shrink-0 border-l border-[var(--color-line)] @[1280px]:block">
      <QueueList />
    </aside>
  );
}
