/** Portfolio skeleti: sarlavha, yuqori panel, 6 ta 4:3 karta */
export default function Loading() {
  return (
    <div className="animate-fade-up" aria-busy="true" aria-label="Yuklanmoqda">
      <div className="h-4 w-28 skeleton" />
      <div className="mt-4 h-9 w-64 max-w-full skeleton" />
      <div className="mt-3 h-4 w-96 max-w-full skeleton" />
      <div className="mt-6 h-[88px] skeleton !rounded-[var(--r-md)]" />
      <div className="mt-4 grid grid-cols-1 gap-3 min-[460px]:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-[var(--r-md)] border border-line">
            <div className="aspect-[4/3] skeleton !rounded-none" />
            <div className="space-y-2 p-3">
              <div className="h-3.5 w-2/3 skeleton" />
              <div className="h-3 w-1/2 skeleton" />
              <div className="mt-3 h-11 skeleton !rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
