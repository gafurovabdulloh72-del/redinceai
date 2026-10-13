export default function Loading() {
  return (
    <div className="container-x" aria-busy="true" aria-label="Yuklanmoqda">
      <div className="max-w-3xl">
        <div className="h-4 w-52 skeleton" />
        <div className="mt-5 h-10 w-72 max-w-full skeleton sm:h-14" />
        <div className="mt-4 h-4 w-full max-w-xl skeleton" />
      </div>
      <div className="mt-8 flex gap-2 overflow-hidden sm:mt-10">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 shrink-0 skeleton !rounded-full" style={{ width: 96 + ((i * 23) % 40) }} />
        ))}
      </div>
      <div className="mt-4 h-[70px] w-full skeleton max-lg:h-[200px]" />
      <div className="mt-6 h-7 w-32 skeleton" />
      <div className="mt-4 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card p-5">
            <div className="flex gap-1.5">
              <div className="h-6 w-24 skeleton !rounded-full" />
              <div className="h-6 w-20 skeleton !rounded-full" />
            </div>
            <div className="mt-4 h-5 w-4/5 skeleton" />
            <div className="mt-3 h-4 w-full skeleton" />
            <div className="mt-2 h-4 w-2/3 skeleton" />
            <div className="mt-5 h-px w-full bg-line" />
            <div className="mt-4 flex justify-between">
              <div className="h-5 w-28 skeleton" />
              <div className="h-4 w-16 skeleton" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
