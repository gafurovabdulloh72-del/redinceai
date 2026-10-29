import { listVacancies } from "@/lib/vacancies/service";
import { professionLabel } from "@/lib/vacancies/format";
import { REGION_BY_SLUG } from "@/lib/constants";
import { buildRss, rssResponse, type FeedItem } from "@/lib/feed/rss";
import { formatPrice } from "@/lib/utils";

export const runtime = "nodejs";
export const revalidate = 1800;

/** Maosh satri — ikkalasi ham bo'sh bo'lsa «Kelishiladi» */
function pay(min: number | null, max: number | null): string {
  if (!min && !max) return "Kelishiladi";
  if (min && max) return `${formatPrice(min)} – ${formatPrice(max)}`;
  return formatPrice((min ?? max) as number);
}

/** Ochiq vakansiyalar RSS lentasi — ish qidiruvchilar lenta o'quvchi/Telegram bot bilan kuzatadi */
export async function GET() {
  const { items } = await listVacancies({ q: "", profession: "", format: "", employment: "", experience: "", region: "", min: 0, pay: "", fresh: "", sort: "newest", page: 1, limit: 40 });
  const feed: FeedItem[] = items.map((v) => ({
    path: `/vakansiyalar/${v.id}`,
    title: `${v.title} — ${v.company}`,
    description: [
      pay(v.salaryMin, v.salaryMax),
      v.regionSlug ? (REGION_BY_SLUG[v.regionSlug]?.name ?? v.regionSlug) : "Masofaviy",
      professionLabel(v.profession, true),
      v.skills.slice(0, 6).join(", "),
    ]
      .filter(Boolean)
      .join(" · "),
    published: v.createdAt,
    category: professionLabel(v.profession, true),
  }));
  return rssResponse(
    buildRss({
      title: "Kasb Egalari — vakansiyalar",
      description: "O'zbekistondagi onlayn kasblar bo'yicha so'nggi ish e'lonlari",
      path: "/vakansiyalar/feed.xml",
      items: feed,
    }),
  );
}
