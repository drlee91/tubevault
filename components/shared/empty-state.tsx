import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <Icon className="h-10 w-10 text-[var(--color-muted)]" aria-hidden />
      <h2 className="text-base font-medium">{title}</h2>
      {description && <p className="max-w-sm text-sm text-[var(--color-muted)]">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
