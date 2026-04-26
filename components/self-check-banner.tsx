"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { SelfCheckResult, CheckStatus } from "@/lib/services/self-check-service";

const tone: Record<CheckStatus, "ok" | "warn" | "error"> = {
  ok: "ok",
  warn: "warn",
  error: "error",
};

export function SelfCheckBanner() {
  const [data, setData] = useState<SelfCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setData)
      .catch((e) => setError(String(e)));
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
        <Badge tone={tone[data.overall]}>{data.overall}</Badge>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[8rem_auto_1fr] items-center gap-x-3 gap-y-2 text-sm">
          {data.checks.map((c) => (
            <div key={c.name} className="contents">
              <dt className="font-mono text-xs text-[var(--color-muted)]">{c.name}</dt>
              <dd>
                <Badge tone={tone[c.status]}>{c.status}</Badge>
              </dd>
              <dd className="truncate text-xs text-[var(--color-muted)]">{c.detail}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
