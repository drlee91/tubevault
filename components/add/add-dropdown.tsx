"use client";

import { useState } from "react";
import { Plus, ListMusic, Video } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { AddPlaylistDialog } from "./add-playlist-dialog";
import { AddVideoDialog } from "./add-video-dialog";

export function AddDropdown() {
  const [openPlaylist, setOpenPlaylist] = useState(false);
  const [openVideo, setOpenVideo] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button className={buttonVariants({ variant: "default", size: "sm" })} />
          }
        >
          <Plus className="h-4 w-4" /> Add
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setOpenPlaylist(true)}>
            <ListMusic className="mr-2 h-4 w-4" /> Add playlist
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setOpenVideo(true)}>
            <Video className="mr-2 h-4 w-4" /> Add video
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AddPlaylistDialog open={openPlaylist} onOpenChange={setOpenPlaylist} />
      <AddVideoDialog
        open={openVideo}
        onOpenChange={setOpenVideo}
        onSwitchToPlaylist={() => setOpenPlaylist(true)}
      />
    </>
  );
}
