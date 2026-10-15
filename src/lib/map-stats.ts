import "server-only";
import { and, desc, eq, gt, isNull, notInArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "./db";
import { jobs, specialists, users } from "./db/schema";
import { getSettings } from "./payments/settings";
import { listableCondition } from "./subscriptions/access";
import { REGIONS } from "./constants";

/**
 * Xarita uchun qo'shimcha statistika: ochiq ish e'lonlari, hozir onlayn mutaxassislar,
 * har hudud bo'yicha top-3 va "sanaga bo'sh"lar. lib/queries.ts dagi og'ir ro'yxat
 * so'rovlariga tegmasdan, faqat xaritaga kerak minimal ustunlar olinadi.
 */

/** Katalogda ko'rinish sharti (queries.ts dagi listable bilan bir xil mantiq) */
async function listableWhere(): Promise<SQL> {
  return and(
    notInArray(specialists.userId, db.select({ id: users.id }).from(users).where(eq(users.isBanned, true))),
    eq(specialists.isHidden, false),
    listableCondition(await getSettings()),
  )!;
}

const emptyCounts = () => Object.fromEntries(REGIONS.map((r) => [r.slug, 0])) as Record<string, number>;

/* ---------------- Ishlar rejimi ---------------- */

export interface MapJob {
  id: string;
  title: string;
  category: string;
  budgetMin: number | null;
  budgetMax: number | null;
  budgetType: "fixed" | "hourly";
  createdAt: number;
}

/** Ochiq (muddati o'tmagan) e'lonlar soni — hudud bo'yicha. Hududsiz (masofaviy) e'lonlar kirmaydi */
export async function getRegionJobCounts(): Promise<Record<string, number>> {
  const now = new Date();
  const rows = await db
    .select({ region: jobs.regionSlug, n: sql<number>`count(*)` })
    .from(jobs)
    .where(and(eq(jobs.status, "open"), or(isNull(jobs.expiresAt), gt(jobs.expiresAt, now))))
    .groupBy(jobs.regionSlug);
  const out = emptyCounts();
  let remote = 0;
  for (const r of rows) {
    if (r.region && r.region in out) out[r.region] += r.n;
    else remote += r.n;
  }
  return Object.assign(out, { remote });
}

/** Har hudud bo'yicha eng yangi ochiq e'lonlar (xarita panelidagi ro'yxat uchun) */
export async function getJobsByRegion(perRegion = 5): Promise<Record<string, MapJob[]>> {
  const now = new Date();
  const rows = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      category: jobs.category,
      region: jobs.regionSlug,
      budgetMin: jobs.budgetMin,
      budgetMax: jobs.budgetMax,
      budgetType: jobs.budgetType,
      createdAt: jobs.createdAt,
    })
    .from(jobs)
    .where(and(eq(jobs.status, "open"), or(isNull(jobs.expiresAt), gt(jobs.expiresAt, now))))
    .orderBy(desc(jobs.createdAt))
    .limit(300);
  const out: Record<string, MapJob[]> = {};
  for (const r of rows) {
    const key = r.region && REGIONS.some((x) => x.slug === r.region) ? r.region : "remote";
    const list = (out[key] ??= []);
    if (list.length >= perRegion) continue;
    list.push({
      id: r.id,
      title: r.title,
      category: r.category,
      budgetMin: r.budgetMin,
      budgetMax: r.budgetMax,
      budgetType: r.budgetType,
      createdAt: r.createdAt instanceof Date ? r.createdAt.getTime() : Number(r.createdAt),
    });
  }
  return out;
}

/* ---------------- Hozir onlayn ---------------- */

export const ONLINE_WINDOW_MS = 3 * 60 * 1000;

/** So'nggi 3 daqiqada saytda bo'lgan (lastSeenAt) katalogdagi mutaxassislar — hudud bo'yicha */
export async function getRegionOnlineCounts(): Promise<Record<string, number>> {
  const since = new Date(Date.now() - ONLINE_WINDOW_MS);
  const rows = await db
    .select({ region: specialists.regionSlug, n: sql<number>`count(*)` })
    .from(specialists)
    .innerJoin(users, eq(users.id, specialists.userId))
    .where(and(await listableWhere(), gt(users.lastSeenAt, since)))
    .groupBy(specialists.regionSlug);
  const out = emptyCounts();
  for (const r of rows) if (r.region in out) out[r.region] += r.n;
  return out;
}

/* ---------------- Hududning top-3 mutaxassisi (hover mini-karta) ---------------- */

export interface MapTopSpecialist {
  slug: string;
  name: string;
  avatarUrl: string | null;
  rating: number;
  reviewCount: number;
  priceFrom: number;
}

export async function getTopByRegion(perRegion = 3): Promise<Record<string, MapTopSpecialist[]>> {
  const rows = await db
    .select({
      slug: specialists.slug,
      region: specialists.regionSlug,
      name: users.name,
      avatarUrl: users.avatarUrl,
      rating: specialists.rating,
      reviewCount: specialists.reviewCount,
      priceFrom: specialists.priceFrom,
    })
    .from(specialists)
    .innerJoin(users, eq(users.id, specialists.userId))
    .where(await listableWhere())
    .orderBy(desc(specialists.rating), desc(specialists.reviewCount), desc(specialists.viewCount));
  const out: Record<string, MapTopSpecialist[]> = {};
  for (const r of rows) {
    const list = (out[r.region] ??= []);
    if (list.length >= perRegion) continue;
    list.push({ slug: r.slug, name: r.name, avatarUrl: r.avatarUrl, rating: r.rating, reviewCount: r.reviewCount, priceFrom: r.priceFrom });
  }
  return out;
}

/* ---------------- Sanaga bo'shlar ---------------- */

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Berilgan kunga bo'sh mutaxassislar soni — hudud bo'yicha: o'sha kun blockedDates ro'yxatida emas
 * va ta'til (vacationUntil, YYYY-MM-DD) o'sha kunni qoplamaydi. Yo'nalish ixtiyoriy.
 */
export async function getAvailableCounts(date: string, category?: string | null): Promise<Record<string, number>> {
  if (!DATE_RE.test(date)) return emptyCounts();
  const conds: SQL[] = [await listableWhere()];
  // blockedDates — JSON massiv ("["2026-11-15", ...]"); sana qo'shtirnoq ichida saqlanadi
  conds.push(sql`${specialists.blockedDates} NOT LIKE ${"%\"" + date + "\"%"}`);
  conds.push(or(isNull(specialists.vacationUntil), sql`${specialists.vacationUntil} < ${date}`)!);
  if (category) conds.push(eq(specialists.category, category));
  const rows = await db
    .select({ region: specialists.regionSlug, n: sql<number>`count(*)` })
    .from(specialists)
    .where(and(...conds))
    .groupBy(specialists.regionSlug);
  const out = emptyCounts();
  for (const r of rows) if (r.region in out) out[r.region] += r.n;
  return out;
}
