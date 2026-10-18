/** Profil skeleti: sarlavha, bo'lim chiplari, 3 ta forma kartasi */
export default function Loading() {
  return (
    <div className="animate-fade-up" aria-busy="true" aria-label="Yuklanmoqda">
      <div className="h-4 w-20 skeleton" />
      <div className="mt-4 h-9 w-72 max-w-full skeleton" />
      <div className="mt-3 h-4 w-80 max-w-full skeleton" />
      <div className="mt-5 flex gap-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-28 skeleton !rounded-full" />
        ))}
      </div>
      <div className="mt-5 space-y-5">
        <div className="h-[420px] skeleton !rounded-[var(--r-md)]" />
        <div className="h-40 skeleton !rounded-[var(--r-md)]" />
        <div className="h-[520px] skeleton !rounded-[var(--r-md)]" />
      </div>
    </div>
  );
}
