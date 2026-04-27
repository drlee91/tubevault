import { SkeletonRow } from "@/components/shared/skeleton-row";

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <SkeletonRow />
    </div>
  );
}
