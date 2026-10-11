/** /xarita skeleti: sarlavha + chapda xarita kartasi (1000/662 nisbat), o'ngda yo'nalish chiplari va 5 ta qator */
export default function Loading() {
  return (
    <div className="container-x" aria-busy="true" aria-label="Yuklanmoqda">
      {/* Sarlavha skeleti (PageHeader size="lg") */}
      <div className="max-w-3xl">
        <div className="h-3.5 w-64 max-w-full skeleton" />
        <div className="mt-5 h-10 w-80 max-w-full skeleton sm:h-14" />
        <div className="mt-4 h-4 w-full max-w-xl skeleton" />
        <div className="mt-2 h-4 w-2/3 max-w-md skeleton" />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 sm:mt-10 lg:grid-cols-12 lg:gap-6">
        {/* Xarita kartasi */}
        <section className="flex min-w-0 flex-col gap-5 lg:col-span-7">
          <div className="card p-3 sm:p-5">
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="h-4 w-44 skeleton" />
              <div className="h-3 w-28 skeleton" />
            </div>
            <div className="aspect-[1000/662] w-full skeleton !rounded-[var(--r-sm)]" />
            <div className="mt-3 flex gap-1.5 overflow-hidden">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-9 shrink-0 skeleton !rounded-full" style={{ width: 68 + ((i * 23) % 40) }} />
              ))}
            </div>
          </div>
          <div className="card hidden p-5 lg:block">
            <div className="h-3 w-32 skeleton" />
            <div className="mt-3 h-6 w-48 skeleton" />
            <div className="mt-5 h-10 w-24 skeleton" />
            <div className="mt-5 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-7 w-full skeleton" />
              ))}
            </div>
          </div>
        </section>

        {/* Panel: yo'nalish chiplari + ro'yxat */}
        <aside className="flex min-w-0 flex-col gap-4 lg:col-span-5">
          <div>
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="h-3 w-20 skeleton" />
              <div className="h-8 w-44 skeleton !rounded-full" />
            </div>
            <div className="grid auto-cols-max grid-flow-col grid-rows-2 gap-1.5 overflow-hidden">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-10 skeleton !rounded-full" style={{ width: 90 + ((i * 31) % 50) }} />
              ))}
            </div>
          </div>
          <div className="card overflow-hidden">
            <div className="flex items-start gap-3 px-4 pb-4 pt-4 sm:px-5 sm:pt-5">
              <div className="h-11 w-11 shrink-0 skeleton" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-40 skeleton" />
                <div className="h-3.5 w-56 max-w-full skeleton" />
              </div>
            </div>
            <ul className="divide-y divide-line border-t border-line">
              {Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="flex items-center gap-3.5 px-4 py-3.5 sm:px-5">
                  <span className="skeleton h-[46px] w-[46px] shrink-0 !rounded-full" />
                  <span className="flex-1 space-y-2">
                    <span className="skeleton block h-3.5 w-1/2" />
                    <span className="skeleton block h-3 w-3/4" />
                    <span className="skeleton block h-3 w-1/3" />
                  </span>
                  <span className="skeleton hidden h-4 w-24 sm:block" />
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
              <div className="h-3.5 w-40 skeleton" />
              <div className="h-10 w-40 skeleton !rounded-full" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
