/** Arizalarim skeleti */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Yuklanmoqda">
      <div className="h-3.5 w-20 skeleton" />
      <div className="mt-5 h-10 w-64 max-w-full skeleton" />
      <div className="mt-4 h-4 w-72 max-w-full skeleton" />
      <div className="mt-6 h-10 w-80 max-w-full skeleton !rounded-full" />
      <ul className="mt-4 grid gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <li key={i} className="card p-4 sm:p-5">
            <div className="flex gap-2">
              <div className="h-6 w-16 skeleton !rounded-full" />
              <div className="h-6 w-24 skeleton" />
            </div>
            <div className="mt-3 h-6 w-2/3 skeleton" />
            <div className="mt-2 h-4 w-1/2 skeleton" />
          </li>
        ))}
      </ul>
    </div>
  );
}
