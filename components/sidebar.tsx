import Link from "next/link";
import { Home, Library, Activity, ListMusic } from "lucide-react";

const links = [
  { href: "/", label: "Home", icon: Home },
  { href: "/library", label: "Library", icon: Library },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/playlists", label: "Playlists", icon: ListMusic },
];

export function Sidebar() {
  return (
    <aside className="hidden w-56 shrink-0 border-r border-[var(--color-border)] p-3 md:block">
      <nav className="flex flex-col gap-1">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-[var(--color-muted-bg)]"
          >
            <l.icon className="h-4 w-4" />
            <span>{l.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
