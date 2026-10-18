/** /admin skeleti: ixcham sarlavha + 4 ta statistika plitkasi + ikki bo'lim (admin/page.tsx tartibi va o'lchamlari bilan bir xil) */
export default function Loading() {
  return (
    <div className="container-x xl:grid xl:grid-cols-[minmax(0,1fr)_190px] xl:gap-10" aria-busy="true" aria-label="Yuklanmoqda">
      <div className="min-w-0">
        {/* Sarlavha: eyebrow + h1 (30px) + bir qatorli tavsif */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <div className="h-3 w-24 skeleton" />
            <div className="mt-2.5 h-8 w-64 max-w-full skeleton" />
            <div className="mt-2.5 h-3.5 w-80 max-w-full skeleton" />
          </div>
          <div className="flex gap-2">
            {[88, 110, 84].map((w) => (
              <div key={w} className="h-9 skeleton !rounded-full" style={{ width: w }} />
            ))}
          </div>
        </div>

        {/* Bo'limlar qatori (faqat tor ekranda) */}
        <div className="mt-6 flex gap-1.5 overflow-hidden xl:hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 shrink-0 skeleton !rounded-full" style={{ width: 96 + ((i * 29) % 48) }} />
          ))}
        </div>

        {/* Statistika plitkalari */}
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[92px] skeleton !rounded-[var(--r-md)]" />
          ))}
        </div>

        {/* Bo'lim: sarlavha + jadval */}
        <div className="mt-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="h-6 w-52 skeleton" />
              <div className="mt-2 h-3.5 w-96 max-w-full skeleton" />
            </div>
            <div className="h-7 w-28 skeleton !rounded-full" />
          </div>
          <div className="mt-4 h-72 skeleton !rounded-[var(--r-md)]" />
        </div>
        <div className="mt-10">
          <div className="h-6 w-40 skeleton" />
          <div className="mt-4 h-48 skeleton !rounded-[var(--r-md)]" />
        </div>
      </div>

      {/* O'ng navigatsiya (xl) */}
      <aside className="hidden xl:block">
        <div className="sticky top-8 space-y-2 pl-3">
          <div className="h-3 w-16 skeleton" />
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-3.5 skeleton" style={{ width: 70 + ((i * 23) % 60) }} />
          ))}
        </div>
      </aside>
    </div>
  );
}
