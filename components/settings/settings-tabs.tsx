"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ReactNode } from "react";

const ORDER = ["general", "storage", "audio", "video", "sync", "advanced"] as const;

export function SettingsTabs({
  general, storage, audio, video, sync, advanced,
}: Record<typeof ORDER[number], ReactNode>) {
  const router = useRouter();
  const sp = useSearchParams();
  const fromUrl = sp.get("tab");
  const current = ORDER.includes(fromUrl as typeof ORDER[number]) ? (fromUrl as typeof ORDER[number]) : "general";
  function setTab(v: string) {
    const next = new URLSearchParams(sp.toString());
    next.set("tab", v);
    router.replace(`/settings?${next.toString()}`);
  }
  return (
    <Tabs value={current} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="storage">Storage</TabsTrigger>
        <TabsTrigger value="audio">Audio</TabsTrigger>
        <TabsTrigger value="video">Video</TabsTrigger>
        <TabsTrigger value="sync">Sync</TabsTrigger>
        <TabsTrigger value="advanced">Advanced</TabsTrigger>
      </TabsList>
      <TabsContent value="general">{general}</TabsContent>
      <TabsContent value="storage">{storage}</TabsContent>
      <TabsContent value="audio">{audio}</TabsContent>
      <TabsContent value="video">{video}</TabsContent>
      <TabsContent value="sync">{sync}</TabsContent>
      <TabsContent value="advanced">{advanced}</TabsContent>
    </Tabs>
  );
}
