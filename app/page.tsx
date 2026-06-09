import { ensureBooted } from "@/lib/boot";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentActivity } from "@/components/dashboard/recent-activity";

export default async function HomePage() {
  const ctx = await ensureBooted();
  const stats = ctx.playlistService.dashboardStats();
  const recent = ctx.playlistService.recentActivity(10);

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--color-fg-muted)]">Local archive overview</p>
      </header>
      <StatsCards data={stats} />
      <section>
        <h2 className="mb-3 text-sm font-medium">Recent activity</h2>
        <RecentActivity items={recent} />
      </section>
    </div>
  );
}
