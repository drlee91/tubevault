"use client";

import { useEffect, useState } from "react";

interface Props {
  iso: string | null;
  /** Override `now` for tests; falls back to Date.now() */
  nowMs?: number;
  className?: string;
}

function format(deltaMs: number): string {
  const s = Math.floor(deltaMs / 1000);
  if (s < 30) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  if (s < 86400 * 365) return `${Math.floor(s / 86400 / 30)}mo ago`;
  return `${Math.floor(s / 86400 / 365)}y ago`;
}

export function RelativeTime({ iso, nowMs, className }: Props) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (nowMs !== undefined) return; // tests pass static now
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [nowMs]);

  if (iso === null) return <span className={className}>never</span>;
  const target = new Date(iso).getTime();
  const now = nowMs ?? Date.now();
  // tick referenced so React re-renders; harmless no-op otherwise
  void tick;
  return <span className={className}>{format(now - target)}</span>;
}
