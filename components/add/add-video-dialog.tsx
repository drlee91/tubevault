"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addVideoAction } from "@/lib/actions/video-actions";

const schema = z.object({
  url: z.string().url(),
  format: z.enum(["audio", "video"]),
});
type Values = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSwitchToPlaylist?: () => void;
}

export function AddVideoDialog({ open, onOpenChange, onSwitchToPlaylist }: Props) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<{ code: string; message: string } | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { url: "", format: "audio" },
  });

  async function onSubmit(values: Values) {
    setSubmitError(null);
    const result = await addVideoAction(values);
    if (!result.ok) {
      if (result.error.field) form.setError(result.error.field as keyof Values, { message: result.error.message });
      else setSubmitError(result.error);
      if (result.error.code === "INTERNAL") toast.error("Couldn't add video", { description: result.error.message });
      return;
    }
    toast.success("Video queued for download");
    form.reset();
    onOpenChange(false);
    router.push("/playlists?tab=standalone");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add video</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://www.youtube.com/watch?v=…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Format</legend>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" value="audio" {...form.register("format")} />
                  Audio
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" value="video" {...form.register("format")} />
                  Video
                </label>
              </div>
            </fieldset>

            {submitError && (
              <div className="space-y-2">
                <p className="text-sm text-[var(--color-status-removed)]">
                  {submitError.code === "VIDEO_ALREADY_TRACKED"
                    ? "Already tracked. Open it from the standalone tab."
                    : submitError.message}
                </p>
                {submitError.code === "URL_NOT_VIDEO" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onOpenChange(false);
                      onSwitchToPlaylist?.();
                    }}
                  >
                    Add as playlist instead
                  </Button>
                )}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>Add</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
