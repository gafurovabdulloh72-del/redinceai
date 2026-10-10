import { SpecialistCardSkeleton } from "@/components/specialists/SpecialistCard";

export default function Loading() {
  return (
    <div className="container-x" aria-busy="true" aria-label="Yuklanmoqda">
      {/* Sarlavha skeleti */}
      <div className="max-w-3xl">
        <div className="h-4 w-52 skeleton" />
        <div className="mt-5 h-10 w-80 max-w-full skeleton sm:h-14" />
        <div className="mt-4 h-4 w-full max-w-xl skeleton" />
      </div>

      <div className="mt-8 grid gap-6 sm:mt-10 lg:grid-cols-12 lg:items-start">
        {/* Yon panel skeleti (yig'iladigan guruhlar) */}
        <aside className="hidden lg:col-span-3 lg:block">
          <div className="card sticky top-24 p-5">
            <div className="flex items-center justify-between">
              <div className="h-5 w-24 skeleton" />
              <div className="h-5 w-16 skeleton" />
            </div>
            <div className="mt-4 h-11 w-full skeleton" />
            <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-4">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-9 skeleton !rounded-full" style={{ width: 72 + ((i * 29) % 50) }} />
              ))}
            </div>
            <div className="mt-4 h-11 w-full skeleton" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="mt-3 flex h-11 items-center justify-between border-t border-line">
                <div className="h-4 w-20 skeleton" />
                <div className="h-4 w-4 skeleton" />
              </div>
            ))}
          </div>
        </aside>

        {/* Natijalar skeleti */}
        <section className="lg:col-span-9">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="h-7 w-40 skeleton" />
            <div className="flex items-center gap-2 max-sm:w-full">
              <div className="h-11 w-28 skeleton !rounded-full lg:hidden" />
              <div className="h-11 w-24 skeleton !rounded-full" />
              <div className="h-11 w-48 skeleton !rounded-full max-sm:flex-1" />
            </div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <SpecialistCardSkeleton key={i} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
