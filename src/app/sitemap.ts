import type { MetadataRoute } from "next";
import { CATEGORIES, REGIONS } from "@/lib/constants";
import { getLandingIndex, getSitemapProfiles } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const now = new Date();

  // Build vaqtida baza bo'lmasligi mumkin — sitemap shunda ham ishlasin
  // Bloklangan / o'chirilgan profillar kiritilmaydi (ularning sahifasi 404, deleted-* slug'lar ochilmasin)
  const specialists = await getSitemapProfiles().catch(() => []);
  const landing = await getLandingIndex().catch(() => []);

  // SEO landing sahifalari (F59/F60): har bir yo'nalish va mutaxassisi bor yo'nalish×hudud juftligi.
  // Bo'sh juftliklar (0 ta mutaxassis) noindex — sitemap'ga kiritilmaydi. lastmod — guruhdagi oxirgi profil yangilanishi.
  const byCategory = new Map<string, Date>();
  for (const row of landing) {
    const prev = byCategory.get(row.category);
    if (!prev || row.lastModified > prev) byCategory.set(row.category, row.lastModified);
  }
  const landingUrls: MetadataRoute.Sitemap = [
    ...CATEGORIES.map((c) => ({ url: `${base}/yonalish/${c.slug}`, lastModified: byCategory.get(c.slug) ?? now, changeFrequency: "daily" as const, priority: 0.8 })),
    ...landing
      .filter((r) => r.n > 0 && REGIONS.some((x) => x.slug === r.region))
      .map((r) => ({ url: `${base}/yonalish/${r.category}/${r.region}`, lastModified: r.lastModified, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];

  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/xarita`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/mutaxassislar`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    ...REGIONS.map((r) => ({ url: `${base}/mutaxassislar?region=${r.slug}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.7 })),
    ...CATEGORIES.map((c) => ({ url: `${base}/mutaxassislar?category=${c.slug}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.7 })),
    ...landingUrls,
    ...specialists.map((s) => ({ url: `${base}/mutaxassislar/${s.slug}`, lastModified: s.updatedAt, changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}
