import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium lowercase tracking-wide",
  {
    variants: {
      tone: {
        ok: "bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-100",
        warn: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
        error: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100",
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
