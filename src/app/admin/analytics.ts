import "server-only";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, payments, specialists, subscriptionInvoices, users } from "@/lib/db/schema";
import { CATEGORY_BY_SLUG, REGION_BY_SLUG } from "@/lib/constants";

/**
 * Admin analitikasi (F86): kunlik daromad (yakunlangan komissiya + obuna), kunlik buyurtmalar,
 * haftalik yangi mutaxassis/mijozlar, top yo'nalish/hududlar va buyurtma voronkasi.
 * Kun/hafta chegaralari — Toshkent vaqti (UTC+5). Grafiklar uchun faqat agregat sonlar qaytadi (shaxsiy ma'lumot yo'q).
 */

const DAY_MS = 86_400_000;
const TZ_MS = 5 * 60 * 60 * 1000;
const DAYS = 30;
const WEEKS = 12;
const TOP_WINDOW_DAYS = 90;

export interface DayPoint {
  /** "2026-10-13" (Toshkent kuni) */
  day: string;
}
export interface RevenueDay extends DayPoint {
  commission: number;
  subscription: number;
}
export interface CountDay extends DayPoint {
  orders: number;
}
export interface SignupWeek {
  /** Hafta boshlanadigan dushanba, "2026-10-12" */
  week: string;
  specialists: number;
  clients: number;
}
export interface RankRow {
  key: string;
  label: string;
  orders: number;
}
export interface FunnelStep {
  key: "created" | "accepted" | "paid" | "released";
  label: string;
  value: number;
}
export interface AdminAnalytics {
  revenue: RevenueDay[];
  orders: CountDay[];
  signups: SignupWeek[];
  topCategories: RankRow[];
  topRegions: RankRow[];
  funnel: FunnelStep[];
  totals: { revenue30: number; commission30: number; subscription30: number; orders30: number; specialists12w: number; clients12w: number };
  windows: { days: number; weeks: number; topDays: number };
}

/** Toshkent kun indeksi (1970-01-01 dan beri) */
const dayIndex = (ms: number) => Math.floor((ms + TZ_MS) / DAY_MS);
const dayKey = (idx: number) => new Date(idx * DAY_MS).toISOString().slice(0, 10);
/** Dushanba bilan boshlanadigan hafta: 1970-01-01 payshanba edi (idx 0 → +3) */
const weekStartIdx = (idx: number) => idx - ((idx + 3) % 7);

/** SQL: ms ustunidan Toshkent kun indeksi (butun son) */
const dayIdxSql = (col: unknown) => sql<number>`cast((${col} + ${TZ_MS}) / ${DAY_MS} as integer)`;

export async function getAdminAnalytics(now = Date.now()): Promise<AdminAnalytics> {
  const today = dayIndex(now);
  const firstDay = today - (DAYS - 1);
  const since = new Date(firstDay * DAY_MS - TZ_MS);
  const firstWeek = weekStartIdx(today) - (WEEKS - 1) * 7;
  const sinceWeek = new Date(firstWeek * DAY_MS - TZ_MS);
  const sinceTop = new Date(now - TOP_WINDOW_DAYS * DAY_MS);

  const commissionDay = dayIdxSql(payments.releasedAt);
  const subDay = dayIdxSql(subscriptionInvoices.paidAt);
  const orderDay = dayIdxSql(orders.createdAt);
  const userDay = dayIdxSql(users.createdAt);

  const [commissionRows, subRows, orderRows, userRows, catRows, regionRows, funnelRow] = await Promise.all([
    db
      .select({ d: commissionDay, v: sql<number>`coalesce(sum(${payments.commissionAmount}), 0)` })
      .from(payments)
      .where(and(eq(payments.state, "released"), gte(payments.releasedAt, since)))
      .groupBy(commissionDay),
    db
      .select({ d: subDay, v: sql<number>`coalesce(sum(${subscriptionInvoices.amount}), 0)` })
      .from(subscriptionInvoices)
      .where(and(eq(subscriptionInvoices.state, "paid"), gte(subscriptionInvoices.paidAt, since)))
      .groupBy(subDay),
    db.select({ d: orderDay, v: sql<number>`count(*)` }).from(orders).where(gte(orders.createdAt, since)).groupBy(orderDay),
    db
      .select({ d: userDay, role: users.role, v: sql<number>`count(*)` })
      .from(users)
      .where(and(gte(users.createdAt, sinceWeek), inArray(users.role, ["client", "specialist"])))
      .groupBy(userDay, users.role),
    db
      .select({ key: specialists.category, v: sql<number>`count(*)` })
      .from(orders)
      .innerJoin(specialists, eq(orders.specialistId, specialists.id))
      .where(gte(orders.createdAt, sinceTop))
      .groupBy(specialists.category)
      .orderBy(sql`count(*) desc`)
      .limit(6),
    db
      .select({ key: specialists.regionSlug, v: sql<number>`count(*)` })
      .from(orders)
      .innerJoin(specialists, eq(orders.specialistId, specialists.id))
      .where(gte(orders.createdAt, sinceTop))
      .groupBy(specialists.regionSlug)
      .orderBy(sql`count(*) desc`)
      .limit(6),
    db
      .select({
        created: sql<number>`count(*)`,
        accepted: sql<number>`sum(case when ${orders.status} in ('accepted', 'in_progress', 'done') or ${orders.paymentState} in ('paid', 'released', 'refunded') then 1 else 0 end)`,
        paid: sql<number>`sum(case when ${orders.paymentState} in ('paid', 'released', 'refunded') then 1 else 0 end)`,
        released: sql<number>`sum(case when ${orders.paymentState} = 'released' then 1 else 0 end)`,
      })
      .from(orders)
      .where(gte(orders.createdAt, sinceTop)),
  ]);

  const commissionBy = new Map(commissionRows.map((r) => [Number(r.d), Number(r.v)]));
  const subBy = new Map(subRows.map((r) => [Number(r.d), Number(r.v)]));
  const ordersBy = new Map(orderRows.map((r) => [Number(r.d), Number(r.v)]));

  const revenue: RevenueDay[] = [];
  const orderDays: CountDay[] = [];
  for (let i = firstDay; i <= today; i++) {
    revenue.push({ day: dayKey(i), commission: commissionBy.get(i) ?? 0, subscription: subBy.get(i) ?? 0 });
    orderDays.push({ day: dayKey(i), orders: ordersBy.get(i) ?? 0 });
  }

  const weekMap = new Map<number, SignupWeek>();
  for (let w = firstWeek; w <= weekStartIdx(today); w += 7) weekMap.set(w, { week: dayKey(w), specialists: 0, clients: 0 });
  for (const r of userRows) {
    const wk = weekMap.get(weekStartIdx(Number(r.d)));
    if (!wk) continue;
    if (r.role === "specialist") wk.specialists += Number(r.v);
    else if (r.role === "client") wk.clients += Number(r.v);
  }
  const signups = [...weekMap.values()];

  const f = funnelRow[0];
  const funnel: FunnelStep[] = [
    { key: "created", label: "Yaratilgan", value: Number(f?.created ?? 0) },
    { key: "accepted", label: "Qabul qilingan", value: Number(f?.accepted ?? 0) },
    { key: "paid", label: "To'langan (eskrou)", value: Number(f?.paid ?? 0) },
    { key: "released", label: "Yakunlangan (released)", value: Number(f?.released ?? 0) },
  ];

  const commission30 = revenue.reduce((s, d) => s + d.commission, 0);
  const subscription30 = revenue.reduce((s, d) => s + d.subscription, 0);

  return {
    revenue,
    orders: orderDays,
    signups,
    topCategories: catRows.map((r) => ({ key: r.key, label: CATEGORY_BY_SLUG[r.key]?.name ?? r.key, orders: Number(r.v) })),
    topRegions: regionRows.map((r) => ({ key: r.key, label: REGION_BY_SLUG[r.key]?.short ?? r.key, orders: Number(r.v) })),
    funnel,
    totals: {
      revenue30: commission30 + subscription30,
      commission30,
      subscription30,
      orders30: orderDays.reduce((s, d) => s + d.orders, 0),
      specialists12w: signups.reduce((s, w) => s + w.specialists, 0),
      clients12w: signups.reduce((s, w) => s + w.clients, 0),
    },
    windows: { days: DAYS, weeks: WEEKS, topDays: TOP_WINDOW_DAYS },
  };
}
