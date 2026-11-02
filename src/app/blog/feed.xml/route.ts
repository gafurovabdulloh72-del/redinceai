import { buildRss, rssResponse } from "@/lib/feed/rss";
import { getSitemapArticles } from "@/lib/blog";
import { SITE } from "@/lib/constants";

export const dynamic = "force-dynamic";

/** Blog RSS 2.0 (kamchilik #48) — layout.tsx alternates orqali avtomatik topiladi */
export async function GET() {
  const items = await getSitemapArticles().catch(() => []);
  return rssResponse(
    buildRss({
      title: `${SITE.name} — blog`,
      description: "Ijodkorlar uchun maslahatlar va platforma yangiliklari",
      path: "/blog",
      items: items.map((a) => ({ title: a.title, description: a.excerpt || a.title, path: `/blog/${a.slug}`, published: a.publishedAt.getTime() })),
    }),
  );
}
