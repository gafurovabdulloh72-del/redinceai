/** /admin/audit skeleti: sarlavha + filtr formasi + chiplar + jadval (sahifa tartibi bilan bir xil) */
export default function Loading() {
  return (
    <div className="container-x" aria-busy="true" aria-label="Yuklanmoqda">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <div className="h-3 w-24 skeleton" />
          <div className="mt-2.5 h-8 w-48 skeleton" />
          <div className="mt-2.5 h-3.5 w-96 max-w-full skeleton" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-20 skeleton !rounded-full" />
          <div className="h-9 w-28 skeleton !rounded-full" />
        </div>
      </div>
      <div className="mt-8 h-[76px] skeleton !rounded-[var(--r-md)]" />
      <div className="mt-4 flex gap-1.5 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 shrink-0 skeleton !rounded-full" style={{ width: 80 + ((i * 31) % 60) }} />
        ))}
      </div>
      <div className="mt-6 h-[420px] skeleton !rounded-[var(--r-md)]" />
    </div>
  );
}
