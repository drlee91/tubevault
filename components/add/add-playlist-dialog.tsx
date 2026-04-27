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
import { Label } from "@/components/ui/label";
import { addPlaylistAction } from "@/lib/actions/playlist-actions";

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add playlist</DialogTitle>
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
              <Label>Default format</Label>
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
