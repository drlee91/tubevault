"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Library, Activity } from "lucide-react";

const links = [
  { href: "/", label: "Home", icon: Home },
  { href: "/playlists", label: "Library", icon: Library },
  { href: "/activity", label: "Activity", icon: Activity },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-[220px] shrink-0 border-r border-[var(--color-line)] p-3 md:block">
      <nav className="flex flex-col gap-1">
        {links.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={
                active
                  ? "relative flex items-center gap-2 rounded px-2 py-1.5 text-sm text-[var(--color-fg)] before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-[var(--color-brand)]"
                  : "flex items-center gap-2 rounded px-2 py-1.5 text-sm text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
              }
            >
              <l.icon className="h-4 w-4" />
              <span>{l.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
