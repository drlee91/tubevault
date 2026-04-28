"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addPlaylistAction } from "@/lib/actions/playlist-actions";
import { useMediaQuery } from "@/lib/client/use-media-query";

const schema = z.object({
  url: z.string().url(),
  defaultFormat: z.enum(["audio", "video"]),
});
type Values = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddPlaylistDialog({ open, onOpenChange }: Props) {
  const router = useRouter();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const sheetClass = !isDesktop
    ? "!top-auto !bottom-0 !left-0 !right-0 !max-w-none !translate-x-0 !translate-y-0 !rounded-b-none !rounded-t-xl data-open:!slide-in-from-bottom data-closed:!slide-out-to-bottom"
    : "";
  const [submitError, setSubmitError] = useState<{ code: string; message: string } | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { url: "", defaultFormat: "audio" },
  });

  async function onSubmit(values: Values) {
    setSubmitError(null);
    const result = await addPlaylistAction(values);
    if (!result.ok) {
      if (result.error.field) form.setError(result.error.field as keyof Values, { message: result.error.message });
      else setSubmitError(result.error);
      if (result.error.code === "INTERNAL") toast.error("Couldn't add playlist", { description: result.error.message });
      return;
    }
    toast.success("Playlist queued for sync");
    form.reset();
    onOpenChange(false);
    router.push(`/playlists/${result.data.playlistId}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={sheetClass}>
        <DialogHeader>
          <DialogTitle>Add playlist</DialogTitle>
          <DialogDescription>
            Paste a YouTube playlist URL and choose the default download format.
          </DialogDescription>
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
                    <Input placeholder="https://www.youtube.com/playlist?list=…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Default format</legend>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" value="audio" {...form.register("defaultFormat")} />
                  Audio
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" value="video" {...form.register("defaultFormat")} />
                  Video
                </label>
              </div>
            </fieldset>

            {submitError && (
              <p className="text-sm text-[var(--color-status-removed)]">
                {submitError.code === "PLAYLIST_ALREADY_TRACKED"
                  ? "Already tracked. Open it from the list."
                  : submitError.message}
              </p>
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
