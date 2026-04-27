import type { ComponentProps } from "react";
import {
  Check,
  Lock,
  Ban,
  ShieldAlert,
  Globe,
  KeyRound,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AvailabilityStatus =
  | "available"
  | "private"
  | "removed"
  | "age_restricted"
  | "region_blocked"
  | "auth_required"
  | "unknown";

const map: Record<AvailabilityStatus, { label: string; icon: LucideIcon; variant: string }> = {
  available: { label: "available", icon: Check, variant: "status-available" },
  private: { label: "private", icon: Lock, variant: "status-private" },
  removed: { label: "removed", icon: Ban, variant: "status-removed" },
  age_restricted: { label: "age restricted", icon: ShieldAlert, variant: "status-private" },
  region_blocked: { label: "region blocked", icon: Globe, variant: "status-private" },
  auth_required: { label: "auth required", icon: KeyRound, variant: "status-private" },
  unknown: { label: "unknown", icon: HelpCircle, variant: "status-unknown" },
};

const variantClass: Record<string, string> = {
  "status-available":
    "bg-[var(--color-status-bg-available)] text-[var(--color-status-available)]",
  "status-private": "bg-[var(--color-status-bg-private)] text-[var(--color-status-private)]",
  "status-removed": "bg-[var(--color-status-bg-removed)] text-[var(--color-status-removed)]",
  "status-unknown": "bg-[var(--color-status-bg-unknown)] text-[var(--color-status-unknown)]",
};

interface Props extends ComponentProps<"span"> {
  status: AvailabilityStatus;
}

export function StatusPill({ status, className, ...rest }: Props) {
  const { label, icon: Icon, variant } = map[status];
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-md px-2 text-xs font-medium tracking-tight lowercase",
        variantClass[variant],
        variant,
        className,
      )}
      {...rest}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}
