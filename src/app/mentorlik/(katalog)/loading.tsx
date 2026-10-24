/** Mentorlik sahifalari (katalog, kurs, ustoz) yuklanayotganda */
export default function Loading() {
  return (
    <div className="container-x" aria-busy="true" aria-live="polite">
      <span className="skeleton mt-6 block h-9 w-64 rounded-[12px]" />
      <span className="skeleton mt-3 block h-4 w-full max-w-md rounded-full" />
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="card overflow-hidden">
            <span className="skeleton block aspect-video w-full !rounded-none" />
            <div className="space-y-2 p-4">
              <span className="skeleton block h-4 w-4/5 rounded-full" />
              <span className="skeleton block h-3 w-3/5 rounded-full" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
