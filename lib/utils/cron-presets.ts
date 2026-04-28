export interface CronPreset {
  value: "off" | "hourly" | "every6h" | "daily03" | "weeklySun03";
  label: string;
  cron: string | null;
}

export const CRON_PRESETS: CronPreset[] = [
  { value: "off", label: "Off", cron: null },
  { value: "hourly", label: "Every hour", cron: "0 * * * *" },
  { value: "every6h", label: "Every 6 hours", cron: "0 */6 * * *" },
  { value: "daily03", label: "Daily 03:00", cron: "0 3 * * *" },
  { value: "weeklySun03", label: "Weekly Sun 03:00", cron: "0 3 * * 0" },
];

export function presetFromCron(cron: string | null): CronPreset["value"] {
  if (cron === null) return "off";
  const found = CRON_PRESETS.find((p) => p.cron === cron);
  return found?.value ?? "off";
}

export function cronFromPreset(value: CronPreset["value"]): string | null {
  return CRON_PRESETS.find((p) => p.value === value)!.cron;
}
