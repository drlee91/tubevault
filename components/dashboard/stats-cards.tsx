import { FormattedBytes } from "@/components/shared/formatted-bytes";

interface Props {
  data: {
    playlists: number;
    trackedVideos: number;
    availablePct: number;
    diskBytes: number;
  };
}

export function StatsCards({ data }: Props) {
  const items = [
    { label: "Playlists", value: String(data.playlists) },
    { label: "Tracked Videos", value: String(data.trackedVideos) },
    { label: "Available", value: `${data.availablePct}%` },
    { label: "Disk Usage", value: <FormattedBytes bytes={data.diskBytes} /> },
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="rounded-xl bg-[var(--color-muted-bg)] p-4">
          <div className="text-[13px] text-[var(--color-fg-muted)]">{it.label}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">{it.value}</div>
        </div>
      ))}
    </div>
  );
}
