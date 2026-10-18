/** Sevimlilar skeleti: sarlavha + 6 ta mutaxassis kartasi */
export default function Loading() {
  return (
    <div className="animate-fade-up" aria-busy="true" aria-label="Yuklanmoqda">
      <div className="h-4 w-20 skeleton" />
      <div className="mt-4 h-9 w-80 max-w-full skeleton" />
      <div className="mt-3 h-4 w-96 max-w-full skeleton" />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[300px] skeleton !rounded-[var(--r-md)]" />
        ))}
      </div>
    </div>
  );
}
