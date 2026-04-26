import { z } from "zod";

export const CreatePlaylistBody = z.object({
  url: z.string().url(),
  defaultFormat: z.enum(["audio", "video"]).default("audio"),
});
export type CreatePlaylistBody = z.infer<typeof CreatePlaylistBody>;

export const AddVideoBody = z.object({
  url: z.string().url(),
  format: z.enum(["audio", "video"]).default("audio"),
});
export type AddVideoBody = z.infer<typeof AddVideoBody>;
