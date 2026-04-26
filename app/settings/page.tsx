import { SelfCheckBanner } from "@/components/self-check-banner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Configure storage paths, formats, sync schedule and external tools.
        </p>
      </header>

      <SelfCheckBanner />

      <Card>
        <CardHeader>
          <CardTitle>Storage</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-[var(--color-muted)]">
          Storage path configuration UI lands in Plan 5.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audio &amp; Video Defaults</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-[var(--color-muted)]">
          Format, bitrate and quality controls land in Plan 5.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sync</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-[var(--color-muted)]">
          Schedule and concurrency controls land in Plan 5.
        </CardContent>
      </Card>
    </div>
  );
}
