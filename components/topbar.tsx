import Link from "next/link";
import { Settings as SettingsIcon } from "lucide-react";
import { AddDropdown } from "@/components/add/add-dropdown";
import { TopbarJobBadge } from "@/components/topbar/topbar-job-badge";

export function Topbar() {
  return (
    <header className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-[var(--color-line)] bg-[var(--color-bg)] px-4">
      <Link href="/" className="text-sm font-bold tracking-tight">TubeVault</Link>
      <div className="flex items-center gap-2">
        <AddDropdown />
        <TopbarJobBadge />
        <Link
          href="/settings"
          aria-label="Settings"
          className="rounded p-1.5 hover:bg-[var(--color-muted-bg)]"
        >
          <SettingsIcon className="h-4 w-4" />
        </Link>
      </div>
    </header>
  );
}
