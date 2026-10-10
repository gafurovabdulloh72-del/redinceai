import { SpecialistCardSkeleton } from "@/components/specialists/SpecialistCard";

export default function Loading() {
  return (
    <div className="container-x" aria-busy="true" aria-label="Yuklanmoqda">
      {/* Sarlavha skeleti */}
      <div className="max-w-3xl">
        <div className="h-7 w-52 skeleton !rounded-full" />
        <div className="mt-4 h-9 w-64 skeleton sm:h-10" />
        <div className="mt-3 h-4 w-full max-w-xl skeleton" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-12">
        {/* Yon panel skeleti */}
        <aside className="hidden lg:col-span-3 lg:block">
          <div className="glass sticky top-24 space-y-4 p-5">
            <div className="h-6 w-28 skeleton" />
            <div className="h-11 w-full skeleton !rounded-[18px]" />
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-7 skeleton !rounded-full" style={{ width: 72 + ((i * 29) % 50) }} />
              ))}
            </div>
            <div className="h-11 w-full skeleton !rounded-[18px]" />
            <div className="h-1.5 w-full skeleton !rounded-full" />
            <div className="h-11 w-full skeleton !rounded-[18px]" />
            <div className="h-14 w-full skeleton !rounded-[18px]" />
          </div>
        </aside>

        {/* Natijalar skeleti */}
        <section className="lg:col-span-9">
          <div className="flex items-center justify-between gap-3">
            <div className="h-7 w-40 skeleton" />
            <div className="h-10 w-28 skeleton !rounded-full sm:w-56" />
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
