import { Card, CardContent } from "@/components/ui/card";
import { FormattedBytes } from "@/components/shared/formatted-bytes";
import { ListMusic, Video, CheckCircle2, HardDrive } from "lucide-react";

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
    { label: "Playlists", value: String(data.playlists), icon: ListMusic },
    { label: "Tracked Videos", value: String(data.trackedVideos), icon: Video },
    { label: "Available", value: `${data.availablePct}%`, icon: CheckCircle2 },
    { label: "Disk Usage", value: <FormattedBytes bytes={data.diskBytes} />, icon: HardDrive },
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map((it) => (
        <Card key={it.label}>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <div className="text-xs text-[var(--color-muted)]">{it.label}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{it.value}</div>
            </div>
            <it.icon className="h-5 w-5 text-[var(--color-muted)]" aria-hidden />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
