import Link from "next/link";
import { Settings as SettingsIcon } from "lucide-react";

export function Topbar() {
  return (
    <header className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4">
      <Link href="/" className="font-mono text-sm font-semibold tracking-tight">
        TubeVault
      </Link>
      <Link
        href="/settings"
        aria-label="Settings"
        className="rounded p-1.5 hover:bg-[var(--color-muted-bg)]"
      >
        <SettingsIcon className="h-4 w-4" />
      </Link>
    </header>
  );
}
