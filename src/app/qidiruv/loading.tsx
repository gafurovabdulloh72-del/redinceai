import { Skeleton } from "@/components/ui";

/** Qidiruv sahifasi skeleton: qidiruv maydoni + tablar + 3 ustunli media to'ri (telefonda ham 3) */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-5" aria-busy="true" aria-live="polite">
      <Skeleton className="h-11 w-full rounded-full" />
      <div className="mt-4 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <div className="mt-5 grid grid-cols-3 gap-0.5 sm:gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-none sm:rounded-lg" />
        ))}
      </div>
    </div>
  );
}
