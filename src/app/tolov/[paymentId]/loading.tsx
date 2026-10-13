/** /tolov/[paymentId] skeleti (layout.tsx huquq tekshiruvidan keyin — 404 haqiqiy bo'lsin): sarlavha + to'lov paneli va xulosa kartasi */
export default function Loading() {
  return (
    <div className="container-x" aria-busy="true" aria-label="Yuklanmoqda">
      {/* Orqaga havola + sarlavha */}
      <div className="h-4 w-36 skeleton" />
      <div className="mt-5 max-w-2xl">
        <div className="h-3.5 w-48 skeleton" />
        <div className="mt-4 h-10 w-72 max-w-full skeleton sm:h-12" />
        <div className="mt-3 h-4 w-full max-w-xl skeleton" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="h-64 skeleton !rounded-[var(--r-md)] lg:col-span-7" />
        <div className="h-48 skeleton !rounded-[var(--r-md)] lg:col-span-5" />
      </div>
    </div>
  );
}
