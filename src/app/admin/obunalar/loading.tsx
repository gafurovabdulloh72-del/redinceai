/** /admin/obunalar skeleti: sarlavha + 6 ta ko'rsatkich + obunachilar jadvali */
export default function Loading() {
  return (
    <div className="container-x" aria-busy="true" aria-label="Yuklanmoqda">
      <div className="h-4 w-24 skeleton" />
      <div className="mt-5 max-w-2xl">
        <div className="h-3 w-24 skeleton" />
        <div className="mt-2.5 h-8 w-64 skeleton" />
        <div className="mt-2.5 h-3.5 w-96 max-w-full skeleton" />
      </div>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[104px] skeleton !rounded-[var(--r-md)]" />
        ))}
      </div>
      <div className="mt-10 h-6 w-40 skeleton" />
      <div className="mt-4 h-[380px] skeleton !rounded-[var(--r-md)]" />
    </div>
  );
}
