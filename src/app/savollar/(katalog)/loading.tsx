import { Skeleton } from "@/components/ui";

/** Maslahat ro'yxati skeleti — faqat (katalog) guruhida (tafsilot sahifasiga ta'sir qilmaydi, yumshoq 404 qoidasi) */
export default function Loading() {
  return (
    <div className="container-x py-6">
      <Skeleton className="mb-5 h-8 w-44 max-sm:hidden" />
      <div className="mb-4 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-24 rounded-full" />
        ))}
      </div>
      <div className="grid gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card flex items-start gap-3.5 p-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-2 h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
