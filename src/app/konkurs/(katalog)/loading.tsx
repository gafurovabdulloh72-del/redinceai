import { Skeleton } from "@/components/ui";

/** Konkurslar ro'yxati skeleti — faqat (katalog) guruhida (yumshoq 404 qoidasi) */
export default function Loading() {
  return (
    <div className="container-x py-6">
      <Skeleton className="mb-5 h-8 w-52 max-sm:hidden" />
      <div className="grid gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card flex gap-4 p-4">
            <Skeleton className="h-20 w-28 rounded-xl" />
            <div className="flex-1">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="mt-2 h-3 w-3/4" />
              <Skeleton className="mt-3 h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
