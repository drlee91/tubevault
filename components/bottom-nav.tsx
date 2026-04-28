import Link from "next/link";
import { Home, Library, Activity, Settings as SettingsIcon } from "lucide-react";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/playlists", label: "Playlists", icon: Library },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function BottomNav() {
  return (
    <nav className="sticky bottom-0 z-10 grid grid-cols-4 border-t border-[var(--color-border)] bg-[var(--color-bg)] md:hidden">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          className="flex flex-col items-center justify-center gap-1 py-2 text-xs"
        >
          <it.icon className="h-5 w-5" />
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
