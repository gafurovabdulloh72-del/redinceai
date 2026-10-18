/** Jamoa sahifasi yuklanish o'rinbosari — hero (muqova 3:1 + sarlavha + tugmalar), tablar, lenta kartalari, yon panel */
export default function Loading() {
  return (
    <div className="container-x" aria-busy="true" aria-live="polite">
      <span className="skeleton inline-block h-3.5 w-32 rounded-full" />
      <div className="card mt-4 overflow-hidden">
        <div className="skeleton aspect-[3/1] max-h-[240px] w-full !rounded-none" />
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div className="min-w-0 flex-1">
            <span className="skeleton block h-8 w-2/3 rounded-[10px]" />
            <span className="skeleton mt-3 block h-3.5 w-1/2 rounded-full" />
            <span className="skeleton mt-4 block h-3.5 w-full max-w-2xl rounded-full" />
            <span className="skeleton mt-2 block h-3.5 w-3/4 max-w-xl rounded-full" />
          </div>
          <div className="flex shrink-0 gap-2">
            <span className="skeleton h-11 w-11 rounded-full" />
            <span className="skeleton h-11 w-28 rounded-full" />
          </div>
        </div>
      </div>
      <div className="mt-6 flex gap-1 border-b border-line">
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className="flex h-11 items-center px-3.5">
            <span className="skeleton h-3.5 w-14 rounded-full" />
          </span>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <div className="grid gap-4 lg:col-span-8">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="card p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <span className="skeleton h-10 w-10 rounded-full" />
                <span className="grid flex-1 gap-2">
                  <span className="skeleton h-3.5 w-1/3 rounded-full" />
                  <span className="skeleton h-3 w-1/5 rounded-full" />
                </span>
              </div>
              <span className="skeleton mt-4 block h-3.5 w-full rounded-full" />
              <span className="skeleton mt-2 block h-3.5 w-5/6 rounded-full" />
            </div>
          ))}
        </div>
        <div className="hidden lg:col-span-4 lg:block">
          <div className="card p-5">
            <span className="skeleton block h-4 w-24 rounded-full" />
            <span className="skeleton mt-3 block h-3.5 w-full rounded-full" />
            <span className="skeleton mt-2 block h-3.5 w-4/5 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
