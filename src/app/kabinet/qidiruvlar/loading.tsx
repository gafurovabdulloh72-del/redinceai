/** Saqlangan qidiruvlar skeleti: sarlavha + 3 ta karta */
export default function Loading() {
  return (
    <div className="animate-fade-up" aria-busy="true" aria-label="Yuklanmoqda">
      <div className="h-4 w-20 skeleton" />
      <div className="mt-4 h-9 w-72 max-w-full skeleton" />
      <div className="mt-3 h-4 w-96 max-w-full skeleton" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-36 skeleton !rounded-[var(--r-md)]" />
        ))}
      </div>
    </div>
  );
}
