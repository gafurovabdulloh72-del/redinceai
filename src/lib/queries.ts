import "server-only";
import { randomInt } from "node:crypto";
import { cache } from "react";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, ne, notInArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "./db";
import { favorites, orderEvents, orders, portfolioItems, reviews, specialists, users } from "./db/schema";
import type { SpecialistFilter } from "./validators";
import { CATEGORIES, DEFAULT_VISIBILITY, REGIONS } from "./constants";
import { getSettings, isTopRated } from "./payments/settings";
import { listableCondition } from "./subscriptions/access";
import { escapeLike, translit } from "./utils";
import { GUEST_VIEWER, isOpenNowFor, tashkentNow, toListItem, type Viewer } from "./privacy";

/** Bloklangan foydalanuvchining profili ro'yxat, statistika va tavsiyalarda chiqmaydi (users.isBanned) */
function notBanned(): SQL {
  return notInArray(specialists.userId, db.select({ id: users.id }).from(users).where(eq(users.isBanned, true)));
}

/**
 * Katalogda ko'rinadiganlar: bloklanmagan VA obunasi faol (sinov / to'langan / imtiyozli kunlar — subscriptions/access.ts).
 * Obunasi tugaganlar ro'yxat, xarita statistikasi, qidiruv takliflari, landing va sitemap'da chiqmaydi;
 * to'g'ridan-to'g'ri profil havolasi esa ochilaveradi (sahifa o'zi ogohlantiradi).
 */
async function listable(): Promise<SQL> {
  return and(notBanned(), listableCondition(await getSettings()))!;
}

/**
 * Muqova yo'q bo'lsa — birinchi portfolio ishining muqovasi (sortOrder, keyin createdAt bo'yicha; F3):
 * kabinetdagi "Birinchi ish muqovada ko'rinadi" ro'yxat kartalarida ham to'g'ri bo'lsin.
 * Alohida bitta so'rov (faqat muqovasizlar uchun) — drizzle `extras` ichidagi bog'liq subquery'da ustun taxalluslarini qayta yozadi.
 */
async function withCovers<T extends { id: string; coverUrl: string | null }>(rows: T[]): Promise<T[]> {
  const missing = rows.filter((r) => !r.coverUrl).map((r) => r.id);
  if (!missing.length) return rows;
  const thumbs = await db
    .select({ specialistId: portfolioItems.specialistId, url: portfolioItems.thumbnailUrl })
    .from(portfolioItems)
    .where(and(inArray(portfolioItems.specialistId, missing), isNotNull(portfolioItems.thumbnailUrl)))
    .orderBy(asc(portfolioItems.sortOrder), asc(portfolioItems.createdAt));
  const first = new Map<string, string>();
  for (const t of thumbs) if (t.url && !first.has(t.specialistId)) first.set(t.specialistId, t.url);
  return rows.map((r) => (r.coverUrl ? r : { ...r, coverUrl: first.get(r.id) ?? null }));
}

/** Apostrof variantlari — utils.translit() bilan bir xil ro'yxat (ustun tomonida SQL replace) */
const APOSTROPHES = ["'", "ʼ", "ʻ", "‘", "’", "`", "´"];
/** Ustunning "sodda" ko'rinishi: kichik harf, apostrofsiz — translit(q) bilan solishtiriladi (E70/F8) */
function plainCol(col: SQL): SQL {
  let s = sql`lower(${col})`;
  for (const a of APOSTROPHES) s = sql`replace(${s}, ${a}, '')`;
  return s;
}
/** LIKE %term% (escape bilan) */
function likeTerm(col: SQL, term: string): SQL {
  return sql`${col} like ${`%${escapeLike(term)}%`} escape '\\'`;
}
/** Ikkala yozuvni ham topadi: asl (kichik harf) va translit/apostrofsiz */
function matchBoth(col: SQL, q: string): SQL {
  const raw = q.toLowerCase();
  const norm = translit(q);
  if (!norm || norm === raw) return likeTerm(sql`lower(${col})`, raw);
  return or(likeTerm(sql`lower(${col})`, raw), likeTerm(plainCol(col), norm))!;
}
/** Ustun apostrofli, so'rov apostrofsiz bo'lishi mumkin ("fargona" → "Farg'ona") — har doim ikkalasi */
function matchAny(col: SQL, q: string): SQL {
  return or(likeTerm(sql`lower(${col})`, q.toLowerCase()), likeTerm(plainCol(col), translit(q)))!;
}
/** JSON massiv ustunida aynan shu element bormi (skills / equipment) — katta-kichik harf farqsiz */
function jsonHas(col: SQL, value: string): SQL {
  return sql`lower(${col}) like ${`%"${escapeLike(value.toLowerCase())}"%`} escape '\\'`;
}

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
  const where = and(...(await specialistFilterConds(filter, viewer)));

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
    items: (await withCovers(items)).map((sp) => toListItem(sp, viewer)),
    total,
    page: filter.page,
    pages: Math.max(1, Math.ceil(total / filter.limit)),
  };
}

/**
 * Ro'yxat filtrlarining SQL shartlari (listSpecialists va saqlangan qidiruv ogohlantirishlari — F53 — bir xil qoida).
 * Har doim: bloklanmagan + obunasi faol (listable).
 */
export async function specialistFilterConds(filter: Omit<SpecialistFilter, "page" | "limit" | "sort">, viewer: Viewer = GUEST_VIEWER): Promise<SQL[]> {
  const base = await listable();
  const conds: SQL[] = [base];

  if (filter.region) conds.push(eq(specialists.regionSlug, filter.region));
  if (filter.skill) conds.push(jsonHas(sql`${specialists.skills}`, filter.skill));
  if (filter.equipment) conds.push(jsonHas(sql`${specialists.equipment}`, filter.equipment));
  if (filter.category) conds.push(eq(specialists.category, filter.category));
  if (filter.experience) conds.push(eq(specialists.experience, filter.experience));
  if (filter.workType) conds.push(jsonHas(sql`${specialists.workTypes}`, filter.workType));
  if (filter.openNow === "1") {
    // "Hozir ochiq" (F42): jadval JS'da (privacy.ts) hisoblanadi — katalog kichik, faqat jadvali bor profillar o'qiladi.
    // Ko'ruvchiga jadval ko'rinmasa — noma'lum, chiqarilmaydi.
    const rows = await db
      .select({ id: specialists.id, schedule: specialists.schedule, vacationUntil: specialists.vacationUntil, visibility: specialists.visibility })
      .from(specialists)
      .where(and(base, isNotNull(specialists.schedule)));
    const now = Date.now();
    const ids = rows.filter((r) => isOpenNowFor(r, viewer, now)).map((r) => r.id);
    conds.push(ids.length ? inArray(specialists.id, ids) : sql`0 = 1`);
  }
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
    // % va _ ekranlanadi ("%" hamma qatorni qaytarmasin); kirill va apostrofsiz yozuv ham topiladi (E70/F8):
    // "Фарғона" / "fargona" → "Farg'ona"
    const q = filter.q;
    const userMatch = db.select({ id: users.id }).from(users).where(matchAny(sql`${users.name}`, q));
    const cityLike = matchAny(sql`${specialists.city}`, q);
    conds.push(
      or(
        matchBoth(sql`${specialists.title}`, q),
        matchBoth(sql`${specialists.bio}`, q),
        levels ? and(cityLike, inArray(visibilityOf("city"), levels))! : cityLike,
        matchBoth(sql`${specialists.skills}`, q),
        inArray(specialists.userId, userMatch),
      )!,
    );
  }
  return conds;
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
    with: { specialist: { with: { user: { columns: { name: true, avatarUrl: true, isBanned: true } } } } },
  });
  // Bloklangan / o'chirilgan akkauntlar sevimlilarda ham ko'rinmaydi (F2)
  const visible = rows.filter((r) => !r.specialist.user.isBanned).map((r) => r.specialist);
  return (await withCovers(visible)).map((sp) => toListItem(sp, viewer));
}

/* ------------------------------------------------------------------ */
/* Bitta profil                                                        */
/* ------------------------------------------------------------------ */
/** generateMetadata + sahifa bitta so'rovda ikki marta chaqiradi — cache() bilan bir marta o'qiladi */
export const getSpecialistBySlug = cache(async (slug: string) => {
  const sp = await db.query.specialists.findFirst({
    where: eq(specialists.slug, slug),
    with: {
      // lastLoginAt — faqat "oxirgi faollik" chelagi uchun (F68); aniq vaqt DTO'ga chiqmaydi
      user: { columns: { id: true, username: true, name: true, avatarUrl: true, phone: true, email: true, gender: true, createdAt: true, lastLoginAt: true, isBanned: true } },
      portfolio: { orderBy: [asc(portfolioItems.sortOrder), asc(portfolioItems.createdAt)] },
      reviews: {
        orderBy: [desc(reviews.createdAt)],
        with: { author: { columns: { name: true, avatarUrl: true } } },
      },
    },
  });
  // Bloklangan foydalanuvchining profili ommaviy emas (404)
  if (!sp || sp.user.isBanned) return null;
  return sp;
});

/** Buyurtma sahifasi uchun qisqa profil (metadata + sahifa — bir marta) */
export const getSpecialistBrief = cache(async (id: string) => {
  const sp = await db.query.specialists.findFirst({
    where: eq(specialists.id, id),
    with: { user: { columns: { name: true, avatarUrl: true, isBanned: true } } },
  });
  if (!sp || sp.user.isBanned) return null;
  return sp;
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
      await listable(),
    ),
    orderBy: [desc(specialists.rating)],
    limit,
    with: { user: { columns: { name: true, avatarUrl: true } } },
  });
  return (await withCovers(rows)).map((r) => toListItem(r, viewer));
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

/* ------------------------------------------------------------------ */
/* Qisqa havola (F66): /u/{shortCode}                                  */
/* ------------------------------------------------------------------ */
/** Seed bilan bir xil alifbo: o'xshash belgilar (0/o, 1/l/i) yo'q */
export const SHORT_CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const SHORT_CODE_RE = /^[a-z0-9]{6}$/;

function randomShortCode(): string {
  return Array.from({ length: 6 }, () => SHORT_CODE_ALPHABET[randomInt(SHORT_CODE_ALPHABET.length)]).join("");
}

/** Mutaxassisning qisqa kodi; yo'q bo'lsa yaratib saqlaydi (unikal indeks to'qnashuvida qayta urinadi) */
export async function ensureShortCode(specialistId: string): Promise<string | null> {
  const row = await db.query.specialists.findFirst({ where: eq(specialists.id, specialistId), columns: { shortCode: true } });
  if (!row) return null;
  if (row.shortCode) return row.shortCode;
  for (let i = 0; i < 6; i++) {
    const code = randomShortCode();
    try {
      const res = await db
        .update(specialists)
        .set({ shortCode: code })
        .where(and(eq(specialists.id, specialistId), isNull(specialists.shortCode)))
        .returning({ code: specialists.shortCode });
      if (res[0]?.code) return res[0].code;
      // Parallel so'rov allaqachon yozgan bo'lsa — o'shani qaytaramiz
      const again = await db.query.specialists.findFirst({ where: eq(specialists.id, specialistId), columns: { shortCode: true } });
      if (again?.shortCode) return again.shortCode;
    } catch {
      /* unikal indeks to'qnashuvi — boshqa kod bilan qayta urinamiz */
    }
  }
  return null;
}

/** /u/[code] → profil slug'i (bloklanganlar uchun null) */
export async function slugByShortCode(code: string): Promise<string | null> {
  const norm = code.trim().toLowerCase();
  if (!SHORT_CODE_RE.test(norm)) return null;
  const row = await db
    .select({ slug: specialists.slug })
    .from(specialists)
    .innerJoin(users, eq(users.id, specialists.userId))
    .where(and(eq(specialists.shortCode, norm), eq(users.isBanned, false)))
    .limit(1);
  return row[0]?.slug ?? null;
}

/* ------------------------------------------------------------------ */
/* Taqqoslash (F54)                                                    */
/* ------------------------------------------------------------------ */
export interface CriteriaAverages {
  quality: number | null;
  timeliness: number | null;
  communication: number | null;
}

/**
 * /taqqoslash: 3 tagacha mutaxassis — ro'yxat DTO'si (toListItem, ko'ruvchiga moslab) + ommaviy paket/tarif ma'lumoti,
 * sharh mezonlari o'rtachasi va javob vaqti. Faqat katalogda ko'rinadiganlar (bloklangan / obunasi tugaganlar chiqmaydi).
 * Natija so'ralgan tartibda.
 */
export async function getCompareSpecialists(ids: string[], viewer: Viewer = GUEST_VIEWER) {
  const unique = [...new Set(ids)].slice(0, 3);
  if (!unique.length) return [];
  const rows = await db.query.specialists.findMany({
    where: and(inArray(specialists.id, unique), await listable()),
    with: { user: { columns: { name: true, avatarUrl: true } } },
  });
  if (!rows.length) return [];
  const found = rows.map((r) => r.id);
  const [criteria, proofs] = await Promise.all([
    db
      .select({
        id: reviews.specialistId,
        quality: sql<number | null>`avg(${reviews.quality})`,
        timeliness: sql<number | null>`avg(${reviews.timeliness})`,
        communication: sql<number | null>`avg(${reviews.communication})`,
      })
      .from(reviews)
      .where(inArray(reviews.specialistId, found))
      .groupBy(reviews.specialistId),
    Promise.all(rows.map((r) => getSocialProof(r.id, r.completedCount))),
  ]);
  const round = (v: number | null) => (v == null || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 10) / 10);
  const byId = new Map(criteria.map((c) => [c.id, { quality: round(c.quality), timeliness: round(c.timeliness), communication: round(c.communication) }]));
  const withCover = await withCovers(rows);
  const out = withCover.map((sp, i) => ({
    ...toListItem(sp, viewer),
    packages: sp.packages,
    rates: sp.rates,
    certificatesCount: sp.certificates.length,
    criteria: byId.get(sp.id) ?? ({ quality: null, timeliness: null, communication: null } satisfies CriteriaAverages),
    completed: proofs[i].completed,
    responseHours: proofs[i].responseHours,
  }));
  return unique.map((id) => out.find((x) => x.id === id)).filter((x): x is (typeof out)[number] => Boolean(x));
}
export type CompareSpecialist = Awaited<ReturnType<typeof getCompareSpecialists>>[number];

/** Bajarilgan buyurtmalar soni — profil statistikasi ("Buyurtma" katagi) */
export async function countCompletedOrders(specialistId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(orders)
    .where(and(eq(orders.specialistId, specialistId), eq(orders.status, "done")));
  return row?.n ?? 0;
}

/** Shu mutaxassis bilan qabul qilingan/bajarilgan buyurtmasi bor mijozlar — "Buyurtma tasdiqlangan" sharh belgisi (F4) */
export async function getVerifiedReviewerIds(specialistId: string): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ id: orders.clientId })
    .from(orders)
    .where(and(eq(orders.specialistId, specialistId), inArray(orders.status, ["accepted", "in_progress", "done"])));
  return new Set(rows.map((r) => r.id));
}

export interface SocialProof {
  /** Bajarilgan (done) buyurtmalar — specialists.completedCount va jonli hisob (kattasi) */
  completed: number;
  /** Kamida 2 ta qabul qilingan/bajarilgan buyurtmasi bor mijozlar ("doimiy mijoz") */
  repeatClients: number;
  /** O'rtacha javob vaqti (soat): buyurtma yaratilganidan birinchi holat o'zgarishigacha (order_events, bo'lmasa updatedAt) */
  responseHours: number | null;
}

/** Ijtimoiy isbot (E86/F12/F68): uchta kichik agregat so'rov */
export async function getSocialProof(specialistId: string, completedCount = 0): Promise<SocialProof> {
  const active = inArray(orders.status, ["accepted", "in_progress", "done"]);
  const firstChange = db
    .select({ orderId: orderEvents.orderId, firstAt: sql<number>`min(${orderEvents.createdAt})`.as("first_at") })
    .from(orderEvents)
    .where(and(eq(orderEvents.type, "status"), eq(orderEvents.fromStatus, "new")))
    .groupBy(orderEvents.orderId)
    .as("e");
  const repeat = db
    .select({ clientId: orders.clientId })
    .from(orders)
    .where(and(eq(orders.specialistId, specialistId), active))
    .groupBy(orders.clientId)
    .having(sql`count(*) >= 2`)
    .as("r");

  const [[done], [rep], [resp]] = await Promise.all([
    db.select({ n: count() }).from(orders).where(and(eq(orders.specialistId, specialistId), eq(orders.status, "done"))),
    db.select({ n: count() }).from(repeat),
    db
      .select({ hours: sql<number | null>`avg((coalesce(${firstChange.firstAt}, ${orders.updatedAt}) - ${orders.createdAt}) / 3600000.0)` })
      .from(orders)
      .leftJoin(firstChange, eq(firstChange.orderId, orders.id))
      .where(and(eq(orders.specialistId, specialistId), ne(orders.status, "new"), sql`coalesce(${firstChange.firstAt}, ${orders.updatedAt}) > ${orders.createdAt}`)),
  ]);
  const hours = resp?.hours == null ? null : Number(resp.hours);
  return {
    completed: Math.max(completedCount, done?.n ?? 0),
    repeatClients: rep?.n ?? 0,
    responseHours: hours != null && Number.isFinite(hours) ? hours : null,
  };
}

/** "Odatda N soat ichida javob beradi" — soatlar yaxlitlanadi, 1 kundan oshsa kunlarda */
export function responseTimeLabel(hours: number | null): string | null {
  if (hours == null) return null;
  if (hours < 1) return "Odatda 1 soat ichida javob beradi";
  if (hours < 48) return `Odatda ${Math.ceil(hours)} soat ichida javob beradi`;
  const days = Math.ceil(hours / 24);
  if (days > 7) return null; // juda sekin — ko'rsatmaymiz
  return `Odatda ${days} kun ichida javob beradi`;
}

/* ------------------------------------------------------------------ */
/* Qidiruv takliflari (F49)                                            */
/* ------------------------------------------------------------------ */
export type SuggestionType = "category" | "region" | "specialist" | "skill" | "city";
export interface Suggestion {
  type: SuggestionType;
  label: string;
  /** Ikkinchi qator (masalan, mutaxassis sarlavhasi) */
  hint?: string;
  href: string;
}

/**
 * Ism, ko'nikma, shahar, yo'nalish va hudud bo'yicha 8 tagacha taklif. Faqat ommaviy ma'lumot:
 * shahar faqat `city` ko'rinishi "public" bo'lgan profillardan olinadi; bloklanganlar chiqmaydi. Kirill ham tushuniladi.
 */
export async function suggestSearch(q: string, limit = 8): Promise<Suggestion[]> {
  const norm = translit(q);
  if (!norm) return [];
  const has = (s: string) => translit(s).includes(norm);
  const out: Suggestion[] = [];

  for (const c of CATEGORIES) {
    if (has(c.name) || has(c.plural)) out.push({ type: "category", label: c.plural, hint: "Yo'nalish", href: `/mutaxassislar?category=${c.slug}` });
  }
  for (const r of REGIONS) {
    if (has(r.name) || has(r.capital)) out.push({ type: "region", label: r.name, hint: "Hudud", href: `/mutaxassislar?region=${r.slug}` });
  }
  if (out.length >= limit) return out.slice(0, limit);

  const term = `%${escapeLike(norm)}%`;
  const visible = await listable();
  const [people, skills, cities] = await Promise.all([
    db
      .select({ name: users.name, slug: specialists.slug, title: specialists.title })
      .from(specialists)
      .innerJoin(users, eq(users.id, specialists.userId))
      .where(and(eq(users.isBanned, false), visible, sql`${plainCol(sql`${users.name}`)} like ${term} escape '\\'`))
      .orderBy(desc(specialists.rating))
      .limit(5),
    db.all<{ v: string }>(
      sql`select distinct value as v from ${specialists}, json_each(${specialists.skills}) where ${visible} and ${plainCol(sql`value`)} like ${term} escape '\\' order by value limit 5`,
    ),
    db.all<{ v: string }>(
      sql`select distinct ${specialists.city} as v from ${specialists} where ${visible} and ${visibilityOf("city")} = 'public' and ${plainCol(sql`${specialists.city}`)} like ${term} escape '\\' order by ${specialists.city} limit 5`,
    ),
  ]);

  for (const p of people) out.push({ type: "specialist", label: p.name, hint: p.title, href: `/mutaxassislar/${p.slug}` });
  for (const s of skills) out.push({ type: "skill", label: s.v, hint: "Ko'nikma", href: `/mutaxassislar?skill=${encodeURIComponent(s.v)}` });
  for (const c of cities) out.push({ type: "city", label: c.v, hint: "Shahar", href: `/mutaxassislar?q=${encodeURIComponent(c.v)}` });
  return out.slice(0, limit);
}

/** Sitemap uchun ochiq profillar: bloklangan, o'chirilgan (anonimlashtirilgan — ular ham isBanned) va obunasi tugaganlarsiz */
export async function getSitemapProfiles(): Promise<Array<{ slug: string; updatedAt: Date }>> {
  return db.select({ slug: specialists.slug, updatedAt: specialists.updatedAt }).from(specialists).where(await listable());
}

/** SEO landing sahifalari (F59/F60) uchun kategoriya×hudud bo'yicha oxirgi yangilanish va son */
export async function getLandingIndex(): Promise<Array<{ category: string; region: string; n: number; lastModified: Date }>> {
  const rows = await db
    .select({ category: specialists.category, region: specialists.regionSlug, n: count(), last: sql<number>`max(${specialists.updatedAt})` })
    .from(specialists)
    .where(await listable())
    .groupBy(specialists.category, specialists.regionSlug);
  return rows.map((r) => ({ category: r.category, region: r.region, n: r.n, lastModified: new Date(Number(r.last) || Date.now()) }));
}

/** Landing sahifa statistikasi: son, eng past boshlang'ich narx (0 — "kelishiladi" hisobga olinmaydi), o'rtacha reyting, tasdiqlanganlar */
export async function getLandingStats(category: string, region?: string | null) {
  const conds: SQL[] = [await listable(), eq(specialists.category, category)];
  if (region) conds.push(eq(specialists.regionSlug, region));
  const [row] = await db
    .select({
      n: count(),
      minPrice: sql<number | null>`min(case when ${specialists.priceFrom} > 0 then ${specialists.priceFrom} end)`,
      avgRating: sql<number | null>`avg(case when ${specialists.reviewCount} > 0 then ${specialists.rating} end)`,
      verified: sql<number>`coalesce(sum(case when ${specialists.isVerified} then 1 else 0 end), 0)`,
    })
    .from(specialists)
    .where(and(...conds));
  return {
    n: row?.n ?? 0,
    minPrice: row?.minPrice == null ? null : Number(row.minPrice),
    avgRating: row?.avgRating == null ? null : Math.round(Number(row.avgRating) * 10) / 10,
    verified: Number(row?.verified ?? 0),
  };
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
    .where(await listable())
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
  const rows = await db.select({ category: specialists.category, n: count() }).from(specialists).where(await listable()).groupBy(specialists.category);
  const out: Record<string, number> = {};
  for (const c of CATEGORIES) out[c.slug] = 0;
  for (const row of rows) out[row.category] = row.n;
  return out;
}

export async function getSiteStats() {
  const visible = await listable();
  const [[sp], [ord], [rev], regionsCovered] = await Promise.all([
    db.select({ n: count() }).from(specialists).where(visible),
    db.select({ n: count() }).from(orders),
    db.select({ n: count() }).from(reviews),
    db.selectDistinct({ r: specialists.regionSlug }).from(specialists).where(visible),
  ]);
  return { specialists: sp.n, orders: ord.n, reviews: rev.n, regions: regionsCovered.length };
}

export async function getFeaturedSpecialists(limit = 6) {
  const rows = await db.query.specialists.findMany({
    where: await listable(),
    orderBy: [desc(specialists.isFeatured), desc(specialists.rating), desc(specialists.reviewCount)],
    limit,
    with: { user: { columns: { name: true, avatarUrl: true } } },
  });
  return (await withCovers(rows)).map((r) => toListItem(r));
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
  const rating = Math.round(Number(row.avg) * 10) / 10;
  const sp = await db.query.specialists.findFirst({ where: eq(specialists.id, specialistId), columns: { completedCount: true } });
  // "Top mutaxassis" (F69): payments isTopRated() bilan aynan bir qoida (TOP_RATED_RULE, minCompleted bo'lsa u ham) —
  // aks holda nishon sharh yozilganda va buyurtma yakunlanganda almashib turadi
  await db
    .update(specialists)
    .set({ rating, reviewCount: row.n, topRated: isTopRated({ rating, reviewCount: row.n, completedCount: sp?.completedCount ?? 0 }) })
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
