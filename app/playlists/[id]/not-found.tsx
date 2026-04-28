import { EmptyState } from "@/components/shared/empty-state";
import { ListMusic } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <EmptyState icon={ListMusic} title="Playlist not found" />
    </div>
  );
}
