"use client";
import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { retryJobAction } from "@/lib/actions/job-actions";

export function RetryJobButton({ jobId, onRetried }: { jobId: number; onRetried?: () => void }) {
  const [pending, start] = useTransition();
  function onClick() {
    start(async () => {
      const r = await retryJobAction(jobId);
      if (!r.ok) toast.error("Retry failed", { description: r.error.message });
      else { toast.success("Retry queued"); onRetried?.(); }
    });
  }
  return (
    <Button onClick={onClick} disabled={pending} size="sm" variant="outline" className="gap-1">
      <RefreshCw className={pending ? "h-3 w-3 animate-spin" : "h-3 w-3"} /> Retry
    </Button>
  );
}
