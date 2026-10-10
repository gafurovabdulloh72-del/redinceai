import { SpecialistCardSkeleton } from "@/components/specialists/SpecialistCard";

export default function Loading() {
  return (
    <div className="container-x" aria-busy="true" aria-label="Yuklanmoqda">
      <div className="mb-4 h-4 w-56 skeleton" />
      <div className="card overflow-hidden !rounded-[32px]">
        <div className="h-44 skeleton !rounded-none sm:h-64" />
        <div className="px-5 pb-6 sm:px-8 sm:pb-8">
          <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end">
            <div className="h-28 w-28 skeleton !rounded-full ring-4 ring-surface" />
            <div className="flex-1 space-y-3 sm:pb-1">
              <div className="h-8 w-64 skeleton" />
              <div className="h-4 w-80 max-w-full skeleton" />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-7 w-28 skeleton !rounded-full" />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="space-y-6 lg:col-span-8">
          <div className="h-48 skeleton !rounded-[24px]" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] skeleton !rounded-[20px]" />
            ))}
          </div>
        </div>
        <div className="order-first lg:order-none lg:col-span-4">
          <div className="h-64 skeleton !rounded-[24px]" />
        </div>
      </div>
      <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:mt-24">
        {Array.from({ length: 4 }).map((_, i) => (
          <SpecialistCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
