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
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { updateSettingsAction } from "@/lib/actions/settings-actions";
import { StorageUsageDisplay } from "./storage-usage-display";

const schema = z.object({
  useSingleStoragePath: z.boolean(),
  audioStoragePath: z.string().min(1),
  videoStoragePath: z.string().min(1),
});

type Values = z.infer<typeof schema>;

interface Props {
  initial: {
    audioStoragePath: string;
    videoStoragePath: string;
    useSingleStoragePath: boolean;
  };
}

export function StorageSection({ initial }: Props) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      useSingleStoragePath: initial.useSingleStoragePath,
      audioStoragePath: initial.audioStoragePath,
      videoStoragePath: initial.videoStoragePath,
    },
  });

  const singlePath = form.watch("useSingleStoragePath");

  async function onSubmit(values: Values) {
    const result = await updateSettingsAction(values);
    if (!result.ok) {
      const { code, message, field } = result.error;
      if (
        code === "STORAGE_PATH_INVALID" &&
        (field === "audioStoragePath" || field === "videoStoragePath")
      ) {
        form.setError(field, { message });
      } else {
        toast.error("Save failed", { description: message });
      }
      return;
    }
    toast.success("Settings saved");
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-base font-medium">Storage</h2>
        <p className="text-sm text-[var(--color-muted)]">
          Where downloaded files are stored on disk.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* useSingleStoragePath toggle */}
          <FormField
            control={form.control}
            name="useSingleStoragePath"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border border-[var(--color-border)] px-4 py-3">
                <div className="space-y-0.5">
                  <FormLabel className="text-sm font-medium">
                    Single storage path
                  </FormLabel>
                  <p className="text-xs text-[var(--color-muted)]">
                    Use the audio path for both audio and video.
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

          {/* audioStoragePath */}
          <FormField
            control={form.control}
            name="audioStoragePath"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Audio path</FormLabel>
                <FormControl>
                  <Input placeholder="/data/audio" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* videoStoragePath */}
          <FormField
            control={form.control}
            name="videoStoragePath"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Video path</FormLabel>
                <FormControl>
                  <Input
                    placeholder="/data/video"
                    disabled={singlePath}
                    {...field}
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

      <StorageUsageDisplay />
    </section>
  );
}
