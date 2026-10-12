/** /admin skeleti: sarlavha + 4 ta statistika plitkasi + ikki jadval kartasi (admin/page.tsx tartibi) */
export default function Loading() {
  return (
    <div className="container-x" aria-busy="true" aria-label="Yuklanmoqda">
      {/* Sarlavha */}
      <div className="max-w-2xl">
        <div className="h-3.5 w-40 skeleton" />
        <div className="mt-5 h-10 w-72 max-w-full skeleton sm:h-12" />
        <div className="mt-4 h-4 w-full max-w-md skeleton" />
      </div>

      {/* Bo'limlar qatori */}
      <div className="mt-8 flex gap-1.5 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 shrink-0 skeleton !rounded-full" style={{ width: 96 + ((i * 29) % 48) }} />
        ))}
      </div>

      {/* Statistika plitkalari */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[118px] skeleton !rounded-[var(--r-md)]" />
        ))}
      </div>

      {/* Jadvallar */}
      <div className="mt-6 h-64 skeleton !rounded-[var(--r-md)]" />
      <div className="mt-6 h-80 skeleton !rounded-[var(--r-md)]" />
    </div>
  );
}
