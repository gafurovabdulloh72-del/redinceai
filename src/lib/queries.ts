import "server-only";
import { cache } from "react";
import { and, asc, count, desc, eq, gte, inArray, isNull, lt, lte, or, sql, type SQL } from "drizzle-orm";
import { db } from "./db";
import { favorites, orders, portfolioItems, reviews, specialists, users } from "./db/schema";
import type { SpecialistFilter } from "./validators";
import { CATEGORIES, DEFAULT_VISIBILITY, REGIONS } from "./constants";
import { escapeLike } from "./utils";
import { GUEST_VIEWER, tashkentNow, toListItem, type Viewer } from "./privacy";

/**
 * Ro'yxat filtrlarida ko'ruvchiga ochiq ko'rinish darajalari — privacy.ts canView() bilan hamohang:
 * admin — cheklovsiz (null), kirgan — public+clients, mehmon — faqat public.
 * "orders" darajasi ro'yxat qidiruvida hech qachon mos kelmaydi (buyurtma munosabati bitta mutaxassisga nisbatan).
 */
function visibleLevels(viewer: Viewer): string[] | null {
  if (viewer.role === "admin") return null;
  return viewer.userId ? ["public", "clients"] : ["public"];
}

/** JSON `visibility` ustunidagi maydon darajasi (yo'q bo'lsa — DEFAULT_VISIBILITY) */
function visibilityOf(field: "gender" | "city") {
  return sql`coalesce(json_extract(${specialists.visibility}, ${`$.${field}`}), ${DEFAULT_VISIBILITY[field]})`;
}

/* ------------------------------------------------------------------ */
/* Mutaxassislar ro'yxati                                              */
/* ------------------------------------------------------------------ */
/**
 * Ro'yxat: natija elementlari xavfsiz DTO (telefon/email/aloqa vositalari/ish vaqti yo'q).
 * `viewer` berilsa, "faqat ro'yxatdan o'tganlarga" darajadagi shahar kirgan foydalanuvchiga ko'rinadi.
 */
export async function listSpecialists(filter: SpecialistFilter, viewer: Viewer = GUEST_VIEWER) {
  const conds: SQL[] = [];

  if (filter.region) conds.push(eq(specialists.regionSlug, filter.region));
  if (filter.category) conds.push(eq(specialists.category, filter.category));
  if (filter.experience) conds.push(eq(specialists.experience, filter.experience));
  if (filter.verified === "1") conds.push(eq(specialists.isVerified, true));
  if (filter.available === "1") {
    // Hozir buyurtma qabul qiladiganlar: "Band" emas va ta'tilda emas (isOnVacation bilan bir xil qoida)
    conds.push(eq(specialists.isAvailable, true), or(isNull(specialists.vacationUntil), lt(specialists.vacationUntil, tashkentNow().date))!);
  }
  if (filter.priceMax && filter.priceMax > 0) conds.push(lte(specialists.priceFrom, filter.priceMax));
  // priceMin faqat priceMax'dan kichik bo'lsa qo'llanadi (teskari oraliq — e'tiborsiz)
  if (filter.priceMin && filter.priceMin > 0 && !(filter.priceMax && filter.priceMin >= filter.priceMax)) {
    conds.push(gte(specialists.priceFrom, filter.priceMin));
  }
  // Yashirin jins/shahar filtr yoki qidiruv orqali ham aniqlanmasin (ro'yxat DTO'si ularni maskalaydi)
  const levels = visibleLevels(viewer);
  if (filter.gender) {
    // Jins users jadvalida — subquery orqali
    const byGender = db.select({ id: users.id }).from(users).where(eq(users.gender, filter.gender));
    conds.push(inArray(specialists.userId, byGender));
    if (levels) conds.push(inArray(visibilityOf("gender"), levels));
  }

  if (filter.q) {
    // % va _ belgilarini ekranlaymiz — "%" so'rovi hamma qatorni qaytarmasin
    const term = `%${escapeLike(filter.q.toLowerCase())}%`;
    const likeEsc = (col: SQL) => sql`${col} like ${term} escape '\\'`;
    const userMatch = db.select({ id: users.id }).from(users).where(likeEsc(sql`lower(${users.name})`));
    const cityLike = likeEsc(sql`lower(${specialists.city})`);
    conds.push(
      or(
        likeEsc(sql`lower(${specialists.title})`),
        likeEsc(sql`lower(${specialists.bio})`),
        levels ? and(cityLike, inArray(visibilityOf("city"), levels))! : cityLike,
        likeEsc(sql`lower(${specialists.skills})`),
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
    items: items.map((sp) => toListItem(sp, viewer)),
    total,
    page: filter.page,
    pages: Math.max(1, Math.ceil(total / filter.limit)),
  };
}

export type SpecialistListItem = Awaited<ReturnType<typeof listSpecialists>>["items"][number];

/* ------------------------------------------------------------------ */
/* Sevimlilar                                                          */
/* ------------------------------------------------------------------ */
/** Foydalanuvchining sevimli mutaxassislari ID'lari (yurak tugmalari holati uchun) */
export async function listFavoriteIds(userId: string): Promise<string[]> {
  const rows = await db.select({ id: favorites.specialistId }).from(favorites).where(eq(favorites.userId, userId));
  return rows.map((r) => r.id);
}

/** Sevimli mutaxassislar (oxirgi qo'shilgani birinchi) — ro'yxat DTO'si, ko'ruvchiga moslab maskalangan */
export async function listFavoriteSpecialists(userId: string, viewer: Viewer = { userId }): Promise<SpecialistListItem[]> {
  const rows = await db.query.favorites.findMany({
    where: eq(favorites.userId, userId),
    orderBy: [desc(favorites.createdAt)],
    with: { specialist: { with: { user: { columns: { name: true, avatarUrl: true } } } } },
  });
  return rows.map((r) => toListItem(r.specialist, viewer));
}

/* ------------------------------------------------------------------ */
/* Bitta profil                                                        */
/* ------------------------------------------------------------------ */
/** generateMetadata + sahifa bitta so'rovda ikki marta chaqiradi — cache() bilan bir marta o'qiladi */
export const getSpecialistBySlug = cache(async (slug: string) => {
  const sp = await db.query.specialists.findFirst({
    where: eq(specialists.slug, slug),
    with: {
      user: { columns: { id: true, name: true, avatarUrl: true, phone: true, email: true, gender: true, createdAt: true } },
      portfolio: { orderBy: [asc(portfolioItems.sortOrder), asc(portfolioItems.createdAt)] },
      reviews: {
        orderBy: [desc(reviews.createdAt)],
        with: { author: { columns: { name: true, avatarUrl: true } } },
      },
    },
  });
  return sp ?? null;
});

/** Buyurtma sahifasi uchun qisqa profil (metadata + sahifa — bir marta) */
export const getSpecialistBrief = cache(async (id: string) => {
  const sp = await db.query.specialists.findFirst({
    where: eq(specialists.id, id),
    with: { user: { columns: { name: true, avatarUrl: true } } },
  });
  return sp ?? null;
});

export type SpecialistDetail = NonNullable<Awaited<ReturnType<typeof getSpecialistBySlug>>>;

export async function bumpViewCount(id: string) {
  await db
    .update(specialists)
    .set({ viewCount: sql`${specialists.viewCount} + 1` })
    .where(eq(specialists.id, id));
}

export async function getSimilarSpecialists(sp: { id: string; regionSlug: string; category: string }, limit = 4, viewer: Viewer = GUEST_VIEWER) {
  const rows = await db.query.specialists.findMany({
    where: and(
      or(eq(specialists.regionSlug, sp.regionSlug), eq(specialists.category, sp.category)),
      sql`${specialists.id} != ${sp.id}`,
    ),
    orderBy: [desc(specialists.rating)],
    limit,
    with: { user: { columns: { name: true, avatarUrl: true } } },
  });
  return rows.map((r) => toListItem(r, viewer));
}

/**
 * Ko'ruvchining shu mutaxassis bilan "haqiqiy" buyurtmasi bormi
 * (qabul qilingan / jarayonda / bajarilgan) — "orders" darajadagi maydonlar uchun.
 */
export async function hasAcceptedOrderWith(clientId: string | null | undefined, specialistId: string): Promise<boolean> {
  if (!clientId) return false;
  const row = await db.query.orders.findFirst({
    where: and(eq(orders.clientId, clientId), eq(orders.specialistId, specialistId), inArray(orders.status, ["accepted", "in_progress", "done"])),
    columns: { id: true },
  });
  return Boolean(row);
}

/** Bajarilgan buyurtmalar soni — profil statistikasi ("Buyurtma" katagi) */
export async function countCompletedOrders(specialistId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(orders)
    .where(and(eq(orders.specialistId, specialistId), eq(orders.status, "done")));
  return row?.n ?? 0;
}

/** Sharhlar taqsimoti (5★…1★) — profil sahifasidagi reyting panelida */
export function ratingDistribution(items: Array<{ rating: number }>): Record<1 | 2 | 3 | 4 | 5, number> {
  const out = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;
  for (const r of items) {
    const k = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5;
    out[k] += 1;
  }
  return out;
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
  const rows = await db.query.specialists.findMany({
    orderBy: [desc(specialists.isFeatured), desc(specialists.rating), desc(specialists.reviewCount)],
    limit,
    with: { user: { columns: { name: true, avatarUrl: true } } },
  });
  return rows.map((r) => toListItem(r));
}

/* ------------------------------------------------------------------ */
/* Kabinet                                                             */
/* ------------------------------------------------------------------ */
/**
 * Kabinet va GET /api/orders. Qo'shilgan tomon qatorlari ataylab cheklangan:
 * mutaxassisning aloqa/ish vaqti/maxfiylik sozlamalari va mijozning akkaunt telefoni bu yerga chiqmaydi
 * (mijoz ulashgan raqam — buyurtmaning o'z contactPhone maydoni).
 */
export async function getOrdersForUser(userId: string, specialistId?: string | null) {
  const [asClient, asSpecialist] = await Promise.all([
    db.query.orders.findMany({
      where: eq(orders.clientId, userId),
      orderBy: [desc(orders.createdAt)],
      with: { specialist: { columns: { id: true, slug: true, title: true }, with: { user: { columns: { name: true, avatarUrl: true } } } } },
    }),
    specialistId
      ? db.query.orders.findMany({
          where: eq(orders.specialistId, specialistId),
          orderBy: [desc(orders.createdAt)],
          with: { client: { columns: { name: true, avatarUrl: true } } },
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
