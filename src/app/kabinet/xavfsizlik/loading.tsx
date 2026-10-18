/** Xavfsizlik skeleti: sarlavha, 2 ustunli maxfiylik/bloklanganlar, holat plitkalari, 2 ta forma */
export default function Loading() {
  return (
    <div className="animate-fade-up" aria-busy="true" aria-label="Yuklanmoqda">
      <div className="h-4 w-24 skeleton" />
      <div className="mt-4 h-9 w-72 max-w-full skeleton" />
      <div className="mt-3 h-4 w-96 max-w-full skeleton" />
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="h-72 skeleton !rounded-[var(--r-md)]" />
        <div className="h-72 skeleton !rounded-[var(--r-md)]" />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 skeleton !rounded-[var(--r-md)]" />
        ))}
      </div>
      <div className="mt-4 h-80 skeleton !rounded-[var(--r-md)]" />
      <div className="mt-4 h-64 skeleton !rounded-[var(--r-md)]" />
    </div>
  );
}
