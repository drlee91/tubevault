import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium lowercase tracking-wide",
  {
    variants: {
      tone: {
        ok: "bg-[var(--color-status-bg-available)] text-[var(--color-ok)]",
        warn: "bg-[var(--color-status-bg-private)] text-[var(--color-warn)]",
        error: "bg-[var(--color-status-bg-removed)] text-[var(--color-danger)]",
        muted: "bg-[var(--color-muted-bg)] text-[var(--color-fg-muted)]",
      },
    },
    defaultVariants: { tone: "muted" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
