export default function Loading() {
  return (
    <div className="animate-fade-up" aria-busy="true" aria-label="Yuklanmoqda">
      <div className="h-4 w-24 skeleton" />
      <div className="mt-5 h-10 w-64 skeleton sm:h-12" />
      <div className="mt-4 h-4 w-full max-w-md skeleton" />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 skeleton !rounded-[24px]" />
        ))}
      </div>
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="h-72 skeleton !rounded-[24px] lg:col-span-2" />
        <div className="h-72 skeleton !rounded-[24px]" />
      </div>
    </div>
  );
}
