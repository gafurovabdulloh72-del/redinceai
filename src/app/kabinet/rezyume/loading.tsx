/** Rezyumem skeleti */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Yuklanmoqda">
      <div className="h-3.5 w-20 skeleton" />
      <div className="mt-5 h-10 w-56 max-w-full skeleton" />
      <div className="mt-4 h-4 w-80 max-w-full skeleton" />
      <div className="card mt-8 max-w-3xl space-y-5 p-5 sm:p-6">
        <div className="h-16 w-full skeleton" />
        <div className="h-11 w-full skeleton" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-11 skeleton" />
          <div className="h-11 skeleton" />
        </div>
        <div className="h-36 w-full skeleton" />
        <div className="h-11 w-full skeleton" />
      </div>
    </div>
  );
}
