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
import { Button } from "@/components/ui/button";
import { updateSettingsAction } from "@/lib/actions/settings-actions";

const schema = z.object({
  defaultAudioFormat: z.enum(["mp3", "m4a", "opus", "flac", "best"]),
  defaultAudioBitrate: z.enum(["128", "192", "256", "320", "vbr"]),
  embedThumbnails: z.boolean(),
});

type Values = z.infer<typeof schema>;

interface Props {
  initial: {
    defaultAudioFormat: "mp3" | "m4a" | "opus" | "flac" | "best";
    defaultAudioBitrate: "128" | "192" | "256" | "320" | "vbr";
    embedThumbnails: boolean;
  };
}

export function AudioSection({ initial }: Props) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      defaultAudioFormat: initial.defaultAudioFormat,
      defaultAudioBitrate: initial.defaultAudioBitrate,
      embedThumbnails: initial.embedThumbnails,
    },
  });

  async function onSubmit(values: Values) {
    const result = await updateSettingsAction(values);
    if (!result.ok) {
      toast.error("Save failed", { description: result.error.message });
      return;
    }
    toast.success("Settings saved");
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-base font-medium">Audio</h2>
        <p className="text-sm text-[var(--color-muted)]">
          Default format and quality for audio downloads.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* defaultAudioFormat */}
          <FormField
            control={form.control}
            name="defaultAudioFormat"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Audio format</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mp3">MP3</SelectItem>
                      <SelectItem value="m4a">M4A</SelectItem>
                      <SelectItem value="opus">Opus</SelectItem>
                      <SelectItem value="flac">FLAC</SelectItem>
                      <SelectItem value="best">Best available</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* defaultAudioBitrate */}
          <FormField
            control={form.control}
            name="defaultAudioBitrate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Audio bitrate</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="128">128 kbps</SelectItem>
                      <SelectItem value="192">192 kbps</SelectItem>
                      <SelectItem value="256">256 kbps</SelectItem>
                      <SelectItem value="320">320 kbps</SelectItem>
                      <SelectItem value="vbr">VBR (variable)</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* embedThumbnails */}
          <FormField
            control={form.control}
            name="embedThumbnails"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border border-[var(--color-border)] px-4 py-3">
                <div className="space-y-0.5">
                  <FormLabel className="text-sm font-medium">
                    Embed thumbnails
                  </FormLabel>
                  <p className="text-xs text-[var(--color-muted)]">
                    Embed cover art into the audio file metadata.
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

          <Button type="submit" disabled={form.formState.isSubmitting}>
            Save
          </Button>
        </form>
      </Form>
    </section>
  );
}
