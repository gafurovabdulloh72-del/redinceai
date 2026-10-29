import { Skeleton } from "@/components/ui";

/** TOP reyting skeleton: sarlavha + TOP-3 kartalari + ro'yxat qatorlari */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-5" aria-busy="true" aria-live="polite">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="mt-2 h-4 w-64" />
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-2xl" />
        ))}
      </div>
      <div className="mt-6 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
