import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  count?: number;
}

export function SkeletonRow({ count = 8 }: Props) {
  return (
    <div className="space-y-2" role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          data-slot="skeleton-row"
          className="flex h-12 items-center gap-3 px-2"
        >
          <Skeleton className="h-9 w-12 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-[60%]" />
            <Skeleton className="h-3 w-[30%]" />
          </div>
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}
