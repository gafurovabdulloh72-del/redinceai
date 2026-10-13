import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { specialists } from "@/lib/db/schema";
import { SUBSCRIPTION_LAUNCH_AT, SUBSCRIPTION_PLANS } from "@/lib/constants";
import type { PlatformSettings } from "@/lib/payments/settings";

/**
 * Mutaxassis obunasi — YAGONA qoida manbai (katalog, xarita, qidiruv, sitemap, buyurtma/taklif, kabinet banneri).
 *
 *  until      = subscriptionUntil ?? max(createdAt, SUBSCRIPTION_LAUNCH_AT) + subscriptionTrialDays
 *               (null → bepul sinov; obuna ishga tushishidan oldingi profillar sinovni ishga tushgan kundan oladi)
 *  graceUntil = until + subscriptionGraceDays
 *  status:
 *    off     — subscriptionEnforced = 0: obuna talab qilinmaydi, hamma narsa ochiq (until/daysLeft faqat ma'lumot uchun)
 *    trial   — hali to'lamagan (subscriptionUntil = null) va now <= until
 *    active  — to'langan (subscriptionUntil bor) va now <= until
 *    grace   — until < now <= graceUntil (hali ko'rinadi, buyurtma oladi — to'lash eslatiladi)
 *    expired — now > graceUntil: katalogdan yashirin, kontaktlar yopiq, yangi buyurtma/taklif yo'q
 *  daysLeft: trial/active/off — until'gacha qolgan kun (yuqoriga yaxlitlangan, >= 0); grace — graceUntil'gacha; expired — 0.
 *  paid: subscriptionUntil o'rnatilgan (kamida bir marta to'langan / admin uzaytirgan).
 *
 * Mavjud buyurtmalar va eskrou obunadan qat'i nazar davom etadi. Qoidani boshqa joyda qayta yozmang —
 * shu yerdagi subscriptionState / canReceiveOrders / listableCondition / planPrice / subscriptionPeriod'dan foydalaning.
 */

export type SubscriptionStatus = "trial" | "active" | "grace" | "expired" | "off";

export interface SubscriptionState {
  status: SubscriptionStatus;
  until: Date;
  graceUntil: Date;
  daysLeft: number;
  paid: boolean;
}

/** subscriptionState uchun kerakli mutaxassis maydonlari */
export interface SubscriptionSubject {
  createdAt: Date;
  subscriptionUntil: Date | null;
}

type SubscriptionSettings = Pick<PlatformSettings, "subscriptionTrialDays" | "subscriptionGraceDays" | "subscriptionEnforced">;

const DAY = 86_400_000;

const daysUntil = (t: number, now: number) => Math.max(0, Math.ceil((t - now) / DAY));

/** To'lanmagan profil uchun obuna/sinov tugash vaqti (ms) */
function untilMsOf(sp: SubscriptionSubject, trialDays: number): number {
  if (sp.subscriptionUntil) return sp.subscriptionUntil.getTime();
  return Math.max(sp.createdAt.getTime(), SUBSCRIPTION_LAUNCH_AT) + trialDays * DAY;
}

export function subscriptionState(sp: SubscriptionSubject, s: SubscriptionSettings, now: Date = new Date()): SubscriptionState {
  const paid = sp.subscriptionUntil != null;
  const untilMs = untilMsOf(sp, s.subscriptionTrialDays);
  const graceMs = untilMs + s.subscriptionGraceDays * DAY;
  const t = now.getTime();
  let status: SubscriptionStatus;
  let daysLeft: number;
  if (s.subscriptionEnforced !== 1) {
    status = "off";
    daysLeft = daysUntil(untilMs, t);
  } else if (t <= untilMs) {
    status = paid ? "active" : "trial";
    daysLeft = daysUntil(untilMs, t);
  } else if (t <= graceMs) {
    status = "grace";
    daysLeft = daysUntil(graceMs, t);
  } else {
    status = "expired";
    daysLeft = 0;
  }
  return { status, until: new Date(untilMs), graceUntil: new Date(graceMs), daysLeft, paid };
}

/** Yangi buyurtma qabul qila oladimi / taklif yubora oladimi (expired bo'lmasa — ha) */
export function canReceiveOrders(sp: SubscriptionSubject, s: SubscriptionSettings, now: Date = new Date()): boolean {
  return subscriptionState(sp, s, now).status !== "expired";
}

/**
 * specialists jadvali uchun SQL sharti: katalog / xarita statistikasi / qidiruv takliflari / landing / sitemap'da
 * ko'rinadiganlar. Ekvivalent: enforcement o'chiq YOKI coalesce(subscription_until, max(created_at, LAUNCH) + trial) + grace >= now.
 * Vaqtlar ms butun sonlar. `and(notBanned(), listableCondition(s))` ko'rinishida qo'shing.
 */
export function listableCondition(s: SubscriptionSettings, now: Date = new Date()): SQL {
  if (s.subscriptionEnforced !== 1) return sql`1 = 1`;
  const trialMs = s.subscriptionTrialDays * DAY;
  const cutoff = now.getTime() - s.subscriptionGraceDays * DAY;
  return sql`(coalesce(${specialists.subscriptionUntil}, max(${specialists.createdAt}, ${SUBSCRIPTION_LAUNCH_AT}) + ${trialMs}) >= ${cutoff})`;
}

/** Reja chegirmasi (%): SUBSCRIPTION_PLANS'da yo'q oylar uchun 0 */
export function planDiscountPct(months: number): number {
  return SUBSCRIPTION_PLANS.find((p) => p.months === months)?.discountPct ?? 0;
}

/** Reja narxi (so'm): subscriptionPrice × oylar − chegirma, 1 000 so'mgacha yaxlitlangan */
export function planPrice(months: number, s: Pick<PlatformSettings, "subscriptionPrice">): number {
  const base = s.subscriptionPrice * months;
  return Math.round((base * (100 - planDiscountPct(months))) / 100 / 1000) * 1000;
}

/** Kalendar oy qo'shish/ayirish (UTC); oy oxiri toshib ketsa — maqsad oyning oxirgi kuni (31-yanvar + 1 oy → 28/29-fevral) */
export function addMonths(d: Date, months: number): Date {
  const out = new Date(d.getTime());
  const day = out.getUTCDate();
  out.setUTCDate(1);
  out.setUTCMonth(out.getUTCMonth() + months);
  const last = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate();
  out.setUTCDate(Math.min(day, last));
  return out;
}

/**
 * To'lov tasdiqlanganda (markPaid paytida, hisob yaratilganda emas) qo'shiladigan davr:
 * periodStart = max(now, joriy until) — qolgan sinov/obuna kunlari yo'qolmaydi; grace/expired'da — hozirdan.
 * periodEnd → specialists.subscriptionUntil va subscription_invoices.periodEnd ga yoziladi.
 */
export function subscriptionPeriod(
  sp: SubscriptionSubject,
  months: number,
  s: Pick<PlatformSettings, "subscriptionTrialDays">,
  now: Date = new Date(),
): { periodStart: Date; periodEnd: Date } {
  const untilMs = untilMsOf(sp, s.subscriptionTrialDays);
  const periodStart = new Date(Math.max(now.getTime(), untilMs));
  return { periodStart, periodEnd: addMonths(periodStart, months) };
}
