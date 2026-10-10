export default function Loading() {
  return (
    <div className="container-x" aria-busy="true" aria-label="Yuklanmoqda">
      <div className="mb-5 h-4 w-48 skeleton" />
      {/* Studio sarlavha: eyebrow + display */}
      <div className="h-3.5 w-56 skeleton" />
      <div className="mt-5 h-10 w-72 max-w-full skeleton sm:h-12" />
      <div className="mt-4 h-4 w-full max-w-xl skeleton" />
      <div className="mt-2 h-4 w-2/3 max-w-md skeleton" />

      <div className="mt-8 grid grid-cols-1 gap-6 sm:mt-10 lg:grid-cols-12 lg:gap-8">
        <div className="card space-y-6 p-5 lg:col-span-7 sm:p-7 xl:col-span-8">
          <div>
            <div className="h-3.5 w-24 skeleton" />
            <div className="mt-2 h-11 w-full skeleton" />
          </div>
          <div>
            <div className="h-3.5 w-28 skeleton" />
            <div className="mt-2 h-36 w-full skeleton" />
          </div>
          <div>
            <div className="h-3.5 w-20 skeleton" />
            <div className="mt-2 h-11 w-full skeleton" />
            <div className="mt-2 flex gap-1.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-11 w-24 skeleton !rounded-full" />
              ))}
            </div>
          </div>
          <div>
            <div className="h-3.5 w-20 skeleton" />
            <div className="mt-2 h-11 w-full skeleton" />
          </div>
          <div className="flex justify-end border-t border-line pt-5">
            <div className="h-13 w-56 skeleton !rounded-full" />
          </div>
        </div>
        <div className="space-y-4 lg:col-span-5 xl:col-span-4">
          <div className="h-60 skeleton !rounded-[var(--r-md)]" />
          <div className="h-48 skeleton !rounded-[var(--r-md)]" />
        </div>
      </div>
    </div>
  );
}
