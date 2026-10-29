import { notFound } from "next/navigation";
import { listVacancies } from "@/lib/vacancies/service";
import { PROFESSION_BY_SLUG, professionLabel } from "@/lib/vacancies/format";
import { REGION_BY_SLUG } from "@/lib/constants";
import { buildRss, rssResponse, type FeedItem } from "@/lib/feed/rss";
import { formatPrice } from "@/lib/utils";

export const runtime = "nodejs";
export const revalidate = 1800;

function pay(min: number | null, max: number | null): string {
  if (!min && !max) return "Kelishiladi";
  if (min && max) return `${formatPrice(min)} – ${formatPrice(max)}`;
  return formatPrice((min ?? max) as number);
}

/**
 * Bitta kasb bo'yicha vakansiyalar RSS lentasi.
 * Umumiy lenta hammasini beradi — dizayner uchun IT e'lonlari shovqin. Shu yerda
 * ish qidiruvchi faqat o'z yo'nalishiga obuna bo'ladi.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const prof = PROFESSION_BY_SLUG[slug];
  if (!prof) notFound();
  const { items } = await listVacancies({ q: "", profession: slug as never, format: "", employment: "", experience: "", region: "", min: 0, pay: "", fresh: "", sort: "newest", page: 1, limit: 40 });
  const feed: FeedItem[] = items.map((v) => ({
    path: `/vakansiyalar/${v.id}`,
    title: `${v.title} — ${v.company}`,
    description: [pay(v.salaryMin, v.salaryMax), v.regionSlug ? (REGION_BY_SLUG[v.regionSlug]?.name ?? v.regionSlug) : "Masofaviy", v.skills.slice(0, 6).join(", ")].filter(Boolean).join(" · "),
    published: v.createdAt,
    category: professionLabel(slug, true),
  }));
  return rssResponse(
    buildRss({
      title: `Kasb Egalari — ${prof.name} vakansiyalari`,
      description: `${prof.name} yo'nalishidagi so'nggi ish e'lonlari`,
      path: `/vakansiyalar/kasb/${slug}/feed.xml`,
      items: feed,
    }),
  );
}
