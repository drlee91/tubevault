"use client";

import { useRouter, useSearchParams } from "next/navigation";

const FILTERS = ["all", "available", "unavailable"] as const;
type Filter = typeof FILTERS[number];

export function ItemFilterChips() {
  const router = useRouter();
  const sp = useSearchParams();
  const current = (sp.get("filter") ?? "all") as Filter;
  function set(f: Filter) {
    const next = new URLSearchParams(sp.toString());
    if (f === "all") next.delete("filter"); else next.set("filter", f);
    router.replace(`?${next.toString()}`);
  }
  return (
    <div role="group" aria-label="Filter items" className="flex gap-2">
      {FILTERS.map((f) => (
        <button
          key={f}
          type="button"
          aria-pressed={current === f}
          onClick={() => set(f)}
          className={`rounded-md px-3 py-1 text-xs ${
            current === f
              ? "bg-[var(--color-fg)] text-[var(--color-bg)]"
              : "bg-[var(--color-muted-bg)] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          }`}
        >
          {f}
        </button>
      ))}
    </div>
  );
}
