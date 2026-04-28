"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ReactNode } from "react";

interface Props {
  playlists: ReactNode;
  standalone: ReactNode;
}

export function PlaylistsTabs({ playlists, standalone }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const tab = sp.get("tab") === "standalone" ? "standalone" : "playlists";

  function setTab(v: string) {
    const next = new URLSearchParams(sp.toString());
    next.set("tab", v);
    router.replace(`/playlists?${next.toString()}`);
  }

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="playlists">Playlists</TabsTrigger>
        <TabsTrigger value="standalone">Standalone</TabsTrigger>
      </TabsList>
      <TabsContent value="playlists">{playlists}</TabsContent>
      <TabsContent value="standalone">{standalone}</TabsContent>
    </Tabs>
  );
}
