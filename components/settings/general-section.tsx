"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function GeneralSection() {
  const { theme, setTheme } = useTheme();
  // next-themes resolves the persisted theme only on the client. Render a
  // placeholder until mounted so SSR and first client render agree.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const value = mounted ? (theme ?? "system") : "system";
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-medium">General</h2>
        <p className="text-sm text-[var(--color-fg-muted)]">App-wide preferences.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="theme-select">Theme</Label>
        <Select value={value} onValueChange={(v) => setTheme(v as string)}>
          <SelectTrigger id="theme-select" className="max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </section>
  );
}
