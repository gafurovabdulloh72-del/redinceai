/** Rezyume sahifasi skeleti: sarlavha kartasi + matn + yon panel */
export default function Loading() {
  return (
    <div className="container-x" aria-busy="true" aria-label="Yuklanmoqda">
      <div className="h-4 w-40 skeleton" />
      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="space-y-5 lg:col-span-8">
          <div className="card p-5 sm:p-7">
            <div className="flex gap-1.5">
              <div className="h-6 w-24 skeleton !rounded-full" />
              <div className="h-6 w-28 skeleton !rounded-full" />
            </div>
            <div className="mt-4 h-9 w-4/5 skeleton" />
            <div className="mt-3 h-4 w-2/3 skeleton" />
            <div className="mt-5 h-8 w-48 skeleton" />
          </div>
          <div className="card p-5 sm:p-6">
            <div className="h-5 w-44 skeleton" />
            <div className="mt-4 h-4 w-full skeleton" />
            <div className="mt-2 h-4 w-11/12 skeleton" />
            <div className="mt-2 h-4 w-3/4 skeleton" />
          </div>
        </div>
        <div className="space-y-4 lg:col-span-4">
          <div className="card p-5">
            <div className="h-5 w-32 skeleton" />
            <div className="mt-3 h-24 w-full skeleton" />
            <div className="mt-3 h-11 w-full skeleton !rounded-full" />
          </div>
          <div className="card h-28 p-5" />
        </div>
      </div>
    </div>
  );
}
