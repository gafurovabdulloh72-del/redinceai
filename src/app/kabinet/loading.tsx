export default function Loading() {
  return (
    <div className="animate-fade-up" aria-busy="true" aria-label="Yuklanmoqda">
      {/* Sarlavha */}
      <div className="h-4 w-40 skeleton" />
      <div className="mt-5 h-10 w-72 max-w-full skeleton sm:h-12" />
      <div className="mt-4 h-4 w-full max-w-md skeleton" />

      {/* Onboarding / banner */}
      <div className="mt-6 h-36 skeleton !rounded-[var(--r-md)]" />

      {/* Stat plitkalari */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[118px] skeleton !rounded-[var(--r-md)]" />
        ))}
      </div>

      {/* Buyurtmalar + yon ustun */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3 lg:items-start">
        <div className="h-64 skeleton !rounded-[var(--r-md)] lg:col-span-2" />
        <div className="space-y-5">
          <div className="h-44 skeleton !rounded-[var(--r-md)]" />
          <div className="h-56 skeleton !rounded-[var(--r-md)]" />
        </div>
      </div>
    </div>
  );
}
