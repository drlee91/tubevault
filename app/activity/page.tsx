import { Suspense } from "react";
import { HistoryTab } from "@/components/activity/history-tab";
import { JobsTab } from "@/components/activity/jobs-tab";
import { ActivityTabs } from "@/components/activity/activity-tabs";
import { SkeletonRow } from "@/components/shared/skeleton-row";

export default async function ActivityPage({
  searchParams,
}: { searchParams: Promise<{ tab?: string; status?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header><h1 className="text-2xl font-semibold">Activity</h1></header>
      <Suspense fallback={<SkeletonRow />}>
        <ActivityTabs
          history={<HistoryTab statusFilter={sp.tab === "history" ? sp.status : undefined} />}
          jobs={<JobsTab />}
        />
      </Suspense>
    </div>
  );
}
