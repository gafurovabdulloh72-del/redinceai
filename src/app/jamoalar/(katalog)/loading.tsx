import { PageHeader } from "@/components/ui";

/** Yuklanish o'rinbosari — katalog sxemasi (sarlavha + filtr + 6 ta karta) */
export default function Loading() {
  return (
    <div className="container-x" aria-busy="true" aria-live="polite">
      <PageHeader size="lg" eyebrow={<span className="skeleton inline-block h-3 w-40 rounded-full" />} title={<span className="skeleton inline-block h-12 w-72 rounded-[14px] sm:h-14 sm:w-[28rem]" />} description={<span className="skeleton block h-5 w-full max-w-md rounded-full" />} />
      <div className="card mt-8 h-16" />
      <div className="mt-4 flex flex-wrap gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <span key={i} className="skeleton h-9 w-24 rounded-full" />
        ))}
      </div>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="card p-4 sm:p-5">
            <div className="flex gap-1.5">
              <span className="skeleton h-6 w-16 rounded-full" />
              <span className="skeleton h-6 w-20 rounded-full" />
            </div>
            <span className="skeleton mt-4 block h-5 w-4/5 rounded-full" />
            <span className="skeleton mt-2 block h-4 w-3/5 rounded-full" />
            <span className="skeleton mt-5 block h-4 w-full rounded-full" />
            <span className="skeleton mt-2 block h-4 w-2/3 rounded-full" />
            <div className="mt-5 flex justify-between border-t border-line pt-3.5">
              <span className="skeleton h-5 w-24 rounded-full" />
              <span className="skeleton h-5 w-16 rounded-full" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
