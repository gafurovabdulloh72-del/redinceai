import type { Metadata } from "next";
import Link from "next/link";
import { Newspaper } from "lucide-react";
import { SafeImage } from "@/components/specialists/SafeImage";
import { listArticles } from "@/lib/blog";
import { SITE } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog — maslahatlar va yangiliklar",
  description: `${SITE.name} blogi: ijodkorlar uchun amaliy maslahatlar, narx-navo, mijoz bilan ishlash va platforma yangiliklari.`,
  alternates: { canonical: "/blog" },
  other: { "m-title": "Blog" },
};

/** Blog ro'yxati (kamchilik #48): SEO maqolalari — karta ko'rinishida, yangisi birinchi */
export default async function BlogPage() {
  const items = await listArticles();
  return (
    <div className="container-x animate-fade-up py-6">
      <header className="mb-5 max-sm:hidden">
        <h1 className="display-xl text-fg">Blog</h1>
        <p className="mt-1.5 max-w-xl text-[14px] text-fg-2">Ijodkorlar uchun amaliy maslahatlar, narx-navo va platforma yangiliklari.</p>
      </header>
      {items.length === 0 ? (
        <div className="card p-10 text-center text-[14px] text-fg-3 max-sm:!border-0 max-sm:!bg-transparent max-sm:!shadow-none">
          <Newspaper size={34} strokeWidth={1.5} className="mx-auto mb-3 text-fg-3" />
          Hozircha maqola yo&apos;q — tez orada.
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-sm:gap-0 max-sm:divide-y max-sm:divide-line max-sm:border-y max-sm:border-line">
          {items.map((a) => (
            <li key={a.id} className="m-plain card overflow-hidden p-0 transition hover:border-fg/25">
              <Link href={`/blog/${a.slug}`} className="block max-sm:flex max-sm:gap-3.5 max-sm:px-4 max-sm:py-3">
                {a.coverUrl && (
                  <span className="relative block aspect-[16/9] w-full overflow-hidden bg-surface-2 max-sm:h-20 max-sm:w-28 max-sm:shrink-0 max-sm:rounded-xl">
                    <SafeImage optimize={480} src={a.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  </span>
                )}
                <span className="block min-w-0 p-4 max-sm:p-0">
                  <span className="line-clamp-2 block text-[15.5px] font-bold leading-snug text-fg">{a.title}</span>
                  {a.excerpt && <span className="mt-1.5 line-clamp-2 block text-[13px] leading-snug text-fg-2 max-sm:line-clamp-1">{a.excerpt}</span>}
                  <span className="mt-2 block text-[12px] text-fg-3">
                    {a.publishedAt ? formatDate(new Date(a.publishedAt)) : ""}
                    {a.authorName ? ` · ${a.authorName}` : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
