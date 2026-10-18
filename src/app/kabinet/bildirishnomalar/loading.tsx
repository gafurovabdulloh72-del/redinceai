/** Bildirishnomalar skeleti: sarlavha, sozlamalar qatori, filtr chiplari, 6 ta qator */
export default function Loading() {
  return (
    <div className="animate-fade-up" aria-busy="true" aria-label="Yuklanmoqda">
      <div className="h-4 w-24 skeleton" />
      <div className="mt-4 h-9 w-64 max-w-full skeleton" />
      <div className="mt-3 h-4 w-80 max-w-full skeleton" />
      <div className="mt-6 h-14 skeleton !rounded-[var(--r-md)]" />
      <div className="mt-3 flex gap-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-24 skeleton !rounded-full" />
        ))}
      </div>
      <div className="mt-4 overflow-hidden rounded-[var(--r-md)] border border-line">
        <div className="h-12 border-b border-line bg-surface" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 border-b border-line px-5 py-3.5">
            <div className="h-10 w-10 shrink-0 skeleton !rounded-[12px]" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3.5 w-2/3 skeleton" />
              <div className="h-3 w-full skeleton" />
              <div className="h-2.5 w-1/4 skeleton" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
