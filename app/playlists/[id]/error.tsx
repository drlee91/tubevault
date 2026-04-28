"use client";
import { ErrorCard } from "@/components/shared/error-card";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <ErrorCard title="Something went wrong" message={error.message} onRetry={reset} />
    </div>
  );
}
