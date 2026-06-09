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
import { Button } from "@/components/ui/button";
import { updateSettingsAction } from "@/lib/actions/settings-actions";

const schema = z.object({
  defaultVideoQuality: z.enum(["480p", "720p", "1080p", "1440p", "2160p", "best"]),
});

type Values = z.infer<typeof schema>;

interface Props {
  initial: {
    defaultVideoQuality: "480p" | "720p" | "1080p" | "1440p" | "2160p" | "best";
  };
}

export function VideoSection({ initial }: Props) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      defaultVideoQuality: initial.defaultVideoQuality,
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
        <h2 className="text-base font-medium">Video</h2>
        <p className="text-sm text-[var(--color-fg-muted)]">
          Default resolution for video downloads.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* defaultVideoQuality */}
          <FormField
            control={form.control}
            name="defaultVideoQuality"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Video quality</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="480p">480p</SelectItem>
                      <SelectItem value="720p">720p</SelectItem>
                      <SelectItem value="1080p">1080p</SelectItem>
                      <SelectItem value="1440p">1440p</SelectItem>
                      <SelectItem value="2160p">2160p (4K)</SelectItem>
                      <SelectItem value="best">Best available</SelectItem>
                    </SelectContent>
                  </Select>
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
