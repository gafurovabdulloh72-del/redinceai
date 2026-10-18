import type { MetadataRoute } from "next";
import { CATEGORIES, REGIONS, TERMS_VERSION } from "@/lib/constants";
import { getLandingIndex, getSitemapProfiles } from "@/lib/queries";
import { getSitemapJobs } from "@/lib/jobs";
import { getSitemapGroups } from "@/lib/groups/service";
import { getSitemapResumes, getSitemapVacancies } from "@/lib/vacancies/service";
import { SITE_URL } from "@/lib/site-url";
import { HELP_ARTICLES } from "@/app/yordam/articles";

export const dynamic = "force-dynamic";

/** Statik matnli sahifalar oxirgi marta qachon o'zgargani — har so'rovda «hozir» emas (qidiruv tizimlari lastmod'ga ishonsin) */
const STATIC_UPDATED = new Date("2026-10-18T00:00:00Z");
/** Oferta/maxfiylik — matn versiyasi sanasi */
const LEGAL_UPDATED = new Date(`${TERMS_VERSION}T00:00:00Z`);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = SITE_URL;
  const now = new Date();

  // Build vaqtida baza bo'lmasligi mumkin — sitemap shunda ham ishlasin
  // Bloklangan / o'chirilgan va obunasi tugagan profillar kiritilmaydi (ularning sahifasi 404 yoki noindex)
  const specialists = await getSitemapProfiles().catch(() => []);
  const landing = await getLandingIndex().catch(() => []);
  // Ochiq e'lonlar (muddati o'tmagan, bloklangan mijozlarniki emas)
  const jobs = await getSitemapJobs().catch(() => []);
  // Hamjamiyat va vakansiyalar: ochiq jamoalar, ochiq vakansiyalar, ommaviy rezyumelar (yopiq/muddati o'tgan/bloklanganlar noindex)
  const [groupsList, vacancyList, resumeList] = await Promise.all([getSitemapGroups().catch(() => []), getSitemapVacancies().catch(() => []), getSitemapResumes().catch(() => [])]);
  // Katalog/xarita/bosh sahifa — eng so'nggi profil yangilanishi (hech biri bo'lmasa — hozir)
  const latestProfile = specialists.reduce<Date | null>((m, s) => (!m || s.updatedAt > m ? s.updatedAt : m), null) ?? now;

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
    { url: `${base}/`, lastModified: latestProfile, changeFrequency: "daily", priority: 1 },
    { url: `${base}/xarita`, lastModified: latestProfile, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/mutaxassislar`, lastModified: latestProfile, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/ishlar`, lastModified: jobs[0]?.updatedAt ?? now, changeFrequency: "hourly", priority: 0.8 },
    { url: `${base}/lenta`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/jamoalar`, lastModified: groupsList[0]?.lastModified ?? now, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/vakansiyalar`, lastModified: vacancyList[0]?.updatedAt ?? now, changeFrequency: "hourly", priority: 0.8 },
    { url: `${base}/rezyumelar`, lastModified: resumeList[0]?.updatedAt ?? now, changeFrequency: "daily", priority: 0.6 },
    { url: `${base}/qidiruv`, lastModified: latestProfile, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/narxlar`, lastModified: STATIC_UPDATED, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/buyurtma-berish`, lastModified: STATIC_UPDATED, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/haqida`, lastModified: STATIC_UPDATED, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/yordam`, lastModified: HELP_ARTICLES.reduce<Date>((m, a) => (new Date(a.updated) > m ? new Date(a.updated) : m), STATIC_UPDATED), changeFrequency: "monthly", priority: 0.5 },
    ...HELP_ARTICLES.map((a) => ({ url: `${base}/yordam/${a.slug}`, lastModified: new Date(a.updated), changeFrequency: "monthly" as const, priority: 0.4 })),
    { url: `${base}/oferta`, lastModified: LEGAL_UPDATED, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/maxfiylik`, lastModified: LEGAL_UPDATED, changeFrequency: "yearly", priority: 0.3 },
    ...landingUrls,
    ...specialists.map((s) => ({ url: `${base}/mutaxassislar/${s.slug}`, lastModified: s.updatedAt, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...jobs.map((j) => ({ url: `${base}/ishlar/${j.id}`, lastModified: j.updatedAt, changeFrequency: "daily" as const, priority: 0.5 })),
    ...groupsList.map((g) => ({ url: `${base}/jamoalar/${g.slug}`, lastModified: g.lastModified, changeFrequency: "daily" as const, priority: 0.5 })),
    ...vacancyList.map((v) => ({ url: `${base}/vakansiyalar/${v.id}`, lastModified: v.updatedAt, changeFrequency: "daily" as const, priority: 0.6 })),
    ...resumeList.map((r) => ({ url: `${base}/rezyumelar/${r.id}`, lastModified: r.updatedAt, changeFrequency: "weekly" as const, priority: 0.4 })),
  ];
}
