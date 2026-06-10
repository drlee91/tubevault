"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  title: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorCard({ title, message, onRetry }: Props) {
  return (
    <Card className="border-[var(--color-status-removed)]/30 bg-[var(--color-status-bg-removed)]">
      <CardContent className="flex items-start gap-3 p-4">
        <AlertCircle className="mt-0.5 h-5 w-5 text-[var(--color-status-removed)]" aria-hidden />
        <div className="flex-1">
          <h3 className="text-sm font-medium">{title}</h3>
          {message && <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{message}</p>}
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
