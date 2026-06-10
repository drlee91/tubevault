"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Library, Activity, Settings as SettingsIcon } from "lucide-react";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/playlists", label: "Playlists", icon: Library },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="sticky bottom-0 z-10 grid grid-cols-4 border-t border-[var(--color-line)] bg-[var(--color-bg)] md:hidden">
      {items.map((it) => {
        const active = pathname != null && (it.href === "/" ? pathname === "/" : pathname.startsWith(it.href));
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex flex-col items-center justify-center gap-1 py-2 text-xs ${active ? "text-[var(--color-brand)]" : "text-[var(--color-fg-muted)]"}`}
          >
            <it.icon className="h-5 w-5" />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
