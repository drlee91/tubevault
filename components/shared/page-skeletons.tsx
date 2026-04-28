import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonRow } from "./skeleton-row";

function HeaderSkeleton({ titleWidth = "12rem", subtitleWidth }: { titleWidth?: string; subtitleWidth?: string }) {
  return (
    <header className="space-y-2">
      <Skeleton className="h-8" style={{ width: titleWidth }} />
      {subtitleWidth && <Skeleton className="h-4" style={{ width: subtitleWidth }} />}
    </header>
  );
}

function TabBarSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="flex gap-2 border-b border-[var(--color-border)]">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-24" />
      ))}
    </div>
  );
}

export function PlaylistsPageSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6" role="status" aria-label="Loading playlists">
      <HeaderSkeleton titleWidth="9rem" />
      <TabBarSkeleton count={2} />
      <SkeletonRow count={6} />
    </div>
  );
}

export function ActivityPageSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6" role="status" aria-label="Loading activity">
      <HeaderSkeleton titleWidth="7rem" />
      <TabBarSkeleton count={2} />
      <SkeletonRow count={6} />
    </div>
  );
}

export function SettingsPageSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6" role="status" aria-label="Loading settings">
      <HeaderSkeleton titleWidth="7rem" subtitleWidth="22rem" />
      <Skeleton className="h-12 w-full" />
      <TabBarSkeleton count={6} />
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlaylistDetailPageSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6" role="status" aria-label="Loading playlist">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] pb-4">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-8 w-[60%]" />
          <Skeleton className="h-4 w-[40%]" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-9" />
        </div>
      </header>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-20" />
        ))}
        <Skeleton className="h-9 w-64" />
      </div>
      <SkeletonRow count={8} />
    </div>
  );
}
