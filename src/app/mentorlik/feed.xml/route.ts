import { listCourses } from "@/lib/mentorship/service";
import { buildRss, rssResponse, type FeedItem } from "@/lib/feed/rss";
import { formatPrice } from "@/lib/utils";

export const runtime = "nodejs";
export const revalidate = 1800;

/** E'lon qilingan kurslar RSS lentasi — o'quvchilar yangi bo'limlarni kuzatadi */
export async function GET() {
  const { items } = await listCourses({ sort: "new", limit: 40 });
  const feed: FeedItem[] = items.map((c) => ({
    path: `/mentorlik/${c.slug}`,
    title: c.title,
    description: [
      c.summary,
      `Ustoz: ${c.mentor.name}`,
      c.priceFrom > 0 ? formatPrice(c.priceFrom) : "Bepul",
      `${c.lessonsCount} dars`,
    ]
      .filter(Boolean)
      .join(" · "),
    published: c.createdAt,
    category: c.category,
  }));
  return rssResponse(
    buildRss({
      title: "Kasb Egalari — mentorlik kurslari",
      description: "Ustozlarning yangi bo'limlari va darslari",
      path: "/mentorlik/feed.xml",
      items: feed,
    }),
  );
}
