import { cn } from "@/lib/utils";

export function CoverMosaic({ thumbs, className }: { thumbs: Array<string | null | undefined>; className?: string }) {
  const four = [...thumbs.filter((t): t is string => Boolean(t)), null, null, null, null].slice(0, 4);
  return (
    <div className={cn("grid grid-cols-2 grid-rows-2 overflow-hidden rounded-lg bg-[var(--color-muted-bg)]", className)}>
      {four.map((t, i) =>
        t ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={t} alt="" className="h-full w-full object-cover" />
        ) : (
          <div key={i} className="h-full w-full bg-[var(--color-surface-2)]" />
        ),
      )}
    </div>
  );
}
