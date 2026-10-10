import "server-only";
import { and, asc, count, desc, eq, inArray, like, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "./db";
import { orders, portfolioItems, reviews, specialists, users } from "./db/schema";
import type { SpecialistFilter } from "./validators";
import { CATEGORIES, REGIONS } from "./constants";

/* ------------------------------------------------------------------ */
/* Mutaxassislar ro'yxati                                              */
/* ------------------------------------------------------------------ */
export async function listSpecialists(filter: SpecialistFilter) {
  const conds: SQL[] = [];

  if (filter.region) conds.push(eq(specialists.regionSlug, filter.region));
  if (filter.category) conds.push(eq(specialists.category, filter.category));
  if (filter.experience) conds.push(eq(specialists.experience, filter.experience as "junior"));
  if (filter.verified === "1") conds.push(eq(specialists.isVerified, true));
  if (filter.priceMax && filter.priceMax > 0) conds.push(lte(specialists.priceFrom, filter.priceMax));

  if (filter.q) {
    const term = `%${filter.q.toLowerCase()}%`;
    const userMatch = db.select({ id: users.id }).from(users).where(like(sql`lower(${users.name})`, term));
    conds.push(
      or(
        like(sql`lower(${specialists.title})`, term),
        like(sql`lower(${specialists.bio})`, term),
        like(sql`lower(${specialists.city})`, term),
        like(sql`lower(${specialists.skills})`, term),
        inArray(specialists.userId, userMatch),
      )!,
    );
  }

  const where = conds.length ? and(...conds) : undefined;

  const orderBy = (() => {
    switch (filter.sort) {
      case "price_asc":
        return [asc(specialists.priceFrom), desc(specialists.rating)];
      case "price_desc":
        return [desc(specialists.priceFrom), desc(specialists.rating)];
      case "newest":
        return [desc(specialists.createdAt)];
      case "popular":
        return [desc(specialists.viewCount), desc(specialists.rating)];
      default:
        return [desc(specialists.isFeatured), desc(specialists.rating), desc(specialists.reviewCount)];
    }
  })();

  const offset = (filter.page - 1) * filter.limit;

  const [items, [{ total }]] = await Promise.all([
    db.query.specialists.findMany({
      where,
      orderBy,
      limit: filter.limit,
      offset,
      with: { user: { columns: { name: true, avatarUrl: true } } },
    }),
    db.select({ total: count() }).from(specialists).where(where),
  ]);

  return {
    items,
    total,
    page: filter.page,
    pages: Math.max(1, Math.ceil(total / filter.limit)),
  };
}

export type SpecialistListItem = Awaited<ReturnType<typeof listSpecialists>>["items"][number];

/* ------------------------------------------------------------------ */
/* Bitta profil                                                        */
/* ------------------------------------------------------------------ */
export async function getSpecialistBySlug(slug: string) {
  const sp = await db.query.specialists.findFirst({
    where: eq(specialists.slug, slug),
    with: {
      user: { columns: { id: true, name: true, avatarUrl: true, phone: true, createdAt: true } },
      portfolio: { orderBy: [asc(portfolioItems.sortOrder), desc(portfolioItems.createdAt)] },
      reviews: {
        orderBy: [desc(reviews.createdAt)],
        with: { author: { columns: { name: true, avatarUrl: true } } },
      },
    },
  });
  return sp ?? null;
}

export type SpecialistDetail = NonNullable<Awaited<ReturnType<typeof getSpecialistBySlug>>>;

export async function bumpViewCount(id: string) {
  await db
    .update(specialists)
    .set({ viewCount: sql`${specialists.viewCount} + 1` })
    .where(eq(specialists.id, id));
}

export async function getSimilarSpecialists(sp: { id: string; regionSlug: string; category: string }, limit = 4) {
  return db.query.specialists.findMany({
    where: and(
      or(eq(specialists.regionSlug, sp.regionSlug), eq(specialists.category, sp.category)),
      sql`${specialists.id} != ${sp.id}`,
    ),
    orderBy: [desc(specialists.rating)],
    limit,
    with: { user: { columns: { name: true, avatarUrl: true } } },
  });
}

/* ------------------------------------------------------------------ */
/* Statistika                                                          */
/* ------------------------------------------------------------------ */
export interface RegionStat {
  slug: string;
  total: number;
  byCategory: Record<string, number>;
}

export async function getRegionStats(): Promise<Record<string, RegionStat>> {
  const rows = await db
    .select({ region: specialists.regionSlug, category: specialists.category, n: count() })
    .from(specialists)
    .groupBy(specialists.regionSlug, specialists.category);

  const out: Record<string, RegionStat> = {};
  for (const r of REGIONS) out[r.slug] = { slug: r.slug, total: 0, byCategory: {} };
  for (const row of rows) {
    const stat = out[row.region];
    if (!stat) continue;
    stat.total += row.n;
    stat.byCategory[row.category] = (stat.byCategory[row.category] ?? 0) + row.n;
  }
  return out;
}

export async function getCategoryStats(): Promise<Record<string, number>> {
  const rows = await db.select({ category: specialists.category, n: count() }).from(specialists).groupBy(specialists.category);
  const out: Record<string, number> = {};
  for (const c of CATEGORIES) out[c.slug] = 0;
  for (const row of rows) out[row.category] = row.n;
  return out;
}

export async function getSiteStats() {
  const [[sp], [ord], [rev], regionsCovered] = await Promise.all([
    db.select({ n: count() }).from(specialists),
    db.select({ n: count() }).from(orders),
    db.select({ n: count() }).from(reviews),
    db.selectDistinct({ r: specialists.regionSlug }).from(specialists),
  ]);
  return { specialists: sp.n, orders: ord.n, reviews: rev.n, regions: regionsCovered.length };
}

export async function getFeaturedSpecialists(limit = 6) {
  return db.query.specialists.findMany({
    orderBy: [desc(specialists.isFeatured), desc(specialists.rating), desc(specialists.reviewCount)],
    limit,
    with: { user: { columns: { name: true, avatarUrl: true } } },
  });
}

/* ------------------------------------------------------------------ */
/* Kabinet                                                             */
/* ------------------------------------------------------------------ */
export async function getOrdersForUser(userId: string, specialistId?: string | null) {
  const [asClient, asSpecialist] = await Promise.all([
    db.query.orders.findMany({
      where: eq(orders.clientId, userId),
      orderBy: [desc(orders.createdAt)],
      with: { specialist: { with: { user: { columns: { name: true, avatarUrl: true } } } } },
    }),
    specialistId
      ? db.query.orders.findMany({
          where: eq(orders.specialistId, specialistId),
          orderBy: [desc(orders.createdAt)],
          with: { client: { columns: { name: true, avatarUrl: true, phone: true } } },
        })
      : Promise.resolve([]),
  ]);
  return { asClient, asSpecialist };
}

export async function recalcRating(specialistId: string) {
  const [row] = await db
    .select({ avg: sql<number>`coalesce(avg(${reviews.rating}), 0)`, n: count() })
    .from(reviews)
    .where(eq(reviews.specialistId, specialistId));
  await db
    .update(specialists)
    .set({ rating: Math.round(Number(row.avg) * 10) / 10, reviewCount: row.n })
    .where(eq(specialists.id, specialistId));
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */
export async function getAdminOverview() {
  const [stats, pending, latestUsers, latestOrders] = await Promise.all([
    getSiteStats(),
    db.query.specialists.findMany({
      where: eq(specialists.isVerified, false),
      orderBy: [desc(specialists.createdAt)],
      limit: 50,
      with: { user: { columns: { name: true, email: true, phone: true } } },
    }),
    db.query.users.findMany({ orderBy: [desc(users.createdAt)], limit: 10, columns: { passwordHash: false } }),
    db.query.orders.findMany({
      orderBy: [desc(orders.createdAt)],
      limit: 10,
      with: {
        client: { columns: { name: true } },
        specialist: { with: { user: { columns: { name: true } } } },
      },
    }),
  ]);
  return { stats, pending, latestUsers, latestOrders };
}
