"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ReactNode } from "react";

export function ActivityTabs({ history, jobs }: { history: ReactNode; jobs: ReactNode }) {
  const router = useRouter();
  const sp = useSearchParams();
  const tab = sp.get("tab") === "jobs" ? "jobs" : "history";
  function setTab(v: string) {
    const next = new URLSearchParams(sp.toString());
    next.set("tab", v);
    router.replace(`/activity?${next.toString()}`);
  }
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="history">History</TabsTrigger>
        <TabsTrigger value="jobs">Jobs</TabsTrigger>
      </TabsList>
      <TabsContent value="history">{history}</TabsContent>
      <TabsContent value="jobs">{jobs}</TabsContent>
    </Tabs>
  );
}
