import type { MetadataRoute } from "next";
import { CATEGORIES, REGIONS } from "@/lib/constants";
import { getLandingIndex, getSitemapProfiles } from "@/lib/queries";
import { getSitemapJobs } from "@/lib/jobs";
import { SITE_URL } from "@/lib/site-url";
import { HELP_ARTICLES } from "@/app/yordam/articles";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE_URL;
  const now = new Date();

  // Build vaqtida baza bo'lmasligi mumkin — sitemap shunda ham ishlasin
  // Bloklangan / o'chirilgan va obunasi tugagan profillar kiritilmaydi (ularning sahifasi 404 yoki noindex)
  const specialists = await getSitemapProfiles().catch(() => []);
  const landing = await getLandingIndex().catch(() => []);
  // Ochiq e'lonlar (muddati o'tmagan, bloklangan mijozlarniki emas)
  const jobs = await getSitemapJobs().catch(() => []);

  // SEO landing sahifalari (F59/F60): har bir yo'nalish va mutaxassisi bor yo'nalish×hudud juftligi.
  // Bo'sh juftliklar (0 ta mutaxassis) noindex — sitemap'ga kiritilmaydi. lastmod — guruhdagi oxirgi profil yangilanishi.
  const byCategory = new Map<string, Date>();
  for (const row of landing) {
    const prev = byCategory.get(row.category);
    if (!prev || row.lastModified > prev) byCategory.set(row.category, row.lastModified);
  }
  const landingUrls: MetadataRoute.Sitemap = [
    // Faqat kamida 1 ta ko'rinadigan mutaxassisi bor yo'nalishlar (bo'shlari noindex — kiritilmaydi)
    ...CATEGORIES.filter((c) => byCategory.has(c.slug)).map((c) => ({ url: `${base}/yonalish/${c.slug}`, lastModified: byCategory.get(c.slug) ?? now, changeFrequency: "daily" as const, priority: 0.8 })),
    ...landing
      .filter((r) => r.n > 0 && REGIONS.some((x) => x.slug === r.region))
      .map((r) => ({ url: `${base}/yonalish/${r.category}/${r.region}`, lastModified: r.lastModified, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];

  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/xarita`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/mutaxassislar`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/ishlar`, lastModified: jobs[0]?.updatedAt ?? now, changeFrequency: "hourly", priority: 0.8 },
    { url: `${base}/narxlar`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/buyurtma-berish`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/yordam`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    ...HELP_ARTICLES.map((a) => ({ url: `${base}/yordam/${a.slug}`, lastModified: new Date(a.updated), changeFrequency: "monthly" as const, priority: 0.4 })),
    { url: `${base}/oferta`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/maxfiylik`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    ...landingUrls,
    ...specialists.map((s) => ({ url: `${base}/mutaxassislar/${s.slug}`, lastModified: s.updatedAt, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...jobs.map((j) => ({ url: `${base}/ishlar/${j.id}`, lastModified: j.updatedAt, changeFrequency: "daily" as const, priority: 0.5 })),
  ];
}
