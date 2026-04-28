"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { SelfCheckResult } from "@/lib/services/self-check-service";

function tabFor(name: string): "storage" | "advanced" | null {
  if (name === "yt-dlp" || name === "ffmpeg") return "advanced";
  if (name === "audio_storage" || name === "video_storage") return "storage";
  return null;
}

export function SelfCheckBanner() {
  const [data, setData] = useState<SelfCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then(async (r) => {
        if (!r.ok) throw new Error(`health check failed (${r.status})`);
        return (await r.json()) as SelfCheckResult;
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
        </CardHeader>
        <CardContent>
          <Badge tone="error">unreachable</Badge>
          <p className="mt-2 text-sm text-[var(--color-muted)]">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
        </CardHeader>
        <CardContent>
          <Badge tone="muted">checking…</Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>System Health</CardTitle>
        <Badge tone={data.overall}>{data.overall}</Badge>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[8rem_auto_1fr] items-center gap-x-3 gap-y-2 text-sm">
          {data.checks.map((c) => (
            <div key={c.name} className="contents">
              <dt className="font-mono text-xs text-[var(--color-muted)]">{c.name}</dt>
              <dd>
                <Badge tone={c.status}>{c.status}</Badge>
              </dd>
              <dd className="flex items-center justify-between gap-3">
                <span className="truncate text-xs text-[var(--color-muted)]">{c.detail}</span>
                {c.status !== "ok" && tabFor(c.name) && (
                  <Link
                    href={`/settings?tab=${tabFor(c.name)}`}
                    className="shrink-0 text-xs underline-offset-2 hover:underline text-[var(--color-muted)]"
                  >
                    Configure
                  </Link>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
