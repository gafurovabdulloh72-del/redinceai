import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { CATEGORIES, REGIONS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const now = new Date();

  // Build vaqtida baza bo'lmasligi mumkin — sitemap shunda ham ishlasin
  const specialists = await db.query.specialists.findMany({ columns: { slug: true, updatedAt: true } }).catch(() => []);

  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/mutaxassislar`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    ...REGIONS.map((r) => ({ url: `${base}/mutaxassislar?region=${r.slug}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.7 })),
    ...CATEGORIES.map((c) => ({ url: `${base}/mutaxassislar?category=${c.slug}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.7 })),
    ...specialists.map((s) => ({ url: `${base}/mutaxassislar/${s.slug}`, lastModified: s.updatedAt, changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}
