"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateSettingsAction } from "@/lib/actions/settings-actions";
import {
  CRON_PRESETS,
  presetFromCron,
  cronFromPreset,
} from "@/lib/utils/cron-presets";

const schema = z.object({
  globalSyncCronPreset: z.enum(["off", "hourly", "every6h", "daily03", "weeklySun03"]),
  syncOnStartup: z.boolean(),
  concurrency: z.number().int().min(1).max(10),
});

type Values = z.infer<typeof schema>;

interface Props {
  initial: {
    globalSyncCron: string | null;
    syncOnStartup: boolean;
    concurrency: number;
  };
}

export function SyncSection({ initial }: Props) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      globalSyncCronPreset: presetFromCron(initial.globalSyncCron),
      syncOnStartup: initial.syncOnStartup,
      concurrency: initial.concurrency,
    },
  });

  async function onSubmit(values: Values) {
    const result = await updateSettingsAction({
      globalSyncCron: cronFromPreset(values.globalSyncCronPreset),
      syncOnStartup: values.syncOnStartup,
      concurrency: values.concurrency,
    });
    if (!result.ok) {
      toast.error("Save failed", { description: result.error.message });
      return;
    }
    toast.success("Settings saved");
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-base font-medium">Sync</h2>
        <p className="text-sm text-[var(--color-fg-muted)]">
          Schedule automatic syncs and control concurrency.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* globalSyncCronPreset */}
          <FormField
            control={form.control}
            name="globalSyncCronPreset"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sync schedule</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CRON_PRESETS.map((preset) => (
                        <SelectItem key={preset.value} value={preset.value}>
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* syncOnStartup */}
          <FormField
            control={form.control}
            name="syncOnStartup"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border border-[var(--color-line)] px-4 py-3">
                <div className="space-y-0.5">
                  <FormLabel className="text-sm font-medium">
                    Sync on startup
                  </FormLabel>
                  <p className="text-xs text-[var(--color-fg-muted)]">
                    Run a sync automatically when the app starts.
                  </p>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* concurrency */}
          <FormField
            control={form.control}
            name="concurrency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Concurrency</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    className="max-w-xs"
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={form.formState.isSubmitting}>
            Save
          </Button>
        </form>
      </Form>
    </section>
  );
}
