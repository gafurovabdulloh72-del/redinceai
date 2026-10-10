export default function Loading() {
  return (
    <div className="container-x" aria-busy="true" aria-label="Yuklanmoqda">
      <div className="mb-5 h-4 w-48 skeleton" />
      <div className="h-4 w-28 skeleton" />
      <div className="mt-5 h-10 w-72 max-w-full skeleton sm:h-12" />
      <div className="mt-4 h-4 w-full max-w-xl skeleton" />
      <div className="mt-8 grid gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="h-[520px] skeleton !rounded-[24px] lg:col-span-7 xl:col-span-8" />
        <div className="space-y-4 lg:col-span-5 xl:col-span-4">
          <div className="h-56 skeleton !rounded-[24px]" />
          <div className="h-44 skeleton !rounded-[24px]" />
        </div>
      </div>
    </div>
  );
}
