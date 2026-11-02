import { Skeleton } from "@/components/ui";

/** Blog ro'yxati skeleti — faqat (katalog) guruhida (yumshoq 404 qoidasi: [slug]'da loading yo'q) */
export default function Loading() {
  return (
    <div className="container-x py-6">
      <Skeleton className="mb-5 h-8 w-32 max-sm:hidden" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card overflow-hidden p-0">
            <Skeleton className="aspect-[16/9] w-full !rounded-none" />
            <div className="p-4">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="mt-2 h-3 w-full" />
              <Skeleton className="mt-3 h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
