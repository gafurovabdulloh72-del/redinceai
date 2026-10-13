import "server-only";
import { and, asc, eq, gte, lt, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, payments, payouts, subscriptionInvoices } from "@/lib/db/schema";

/**
 * Mutaxassisning oylik hisoboti (F29): Toshkent vaqti bo'yicha kalendar oy.
 * Faqat shu mutaxassisning (specialistId — sessiyadagi foydalanuvchidan) yozuvlari o'qiladi.
 */

const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
/** Hisobot boshlanadigan eng erta oy (platforma ishga tushgan yil) */
const MIN_YEAR = 2024;

export const MONTH_NAMES = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"] as const;

export interface ReportMonth {
  /** "2026-10" */
  key: string;
  y: number;
  /** 1–12 */
  m: number;
  /** "Oktabr 2026" */
  label: string;
  startMs: number;
  endMs: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

function monthOf(y: number, m: number): ReportMonth {
  return {
    key: `${y}-${pad(m)}`,
    y,
    m,
    label: `${MONTH_NAMES[m - 1]} ${y}`,
    startMs: Date.UTC(y, m - 1, 1) - TASHKENT_OFFSET_MS,
    endMs: Date.UTC(y, m, 1) - TASHKENT_OFFSET_MS,
  };
}

export function currentMonth(now = Date.now()): ReportMonth {
  const t = new Date(now + TASHKENT_OFFSET_MS);
  return monthOf(t.getUTCFullYear(), t.getUTCMonth() + 1);
}

/** ?oy=YYYY-MM → oy; noto'g'ri, juda erta yoki kelajakdagi qiymat → joriy oy */
export function parseMonth(raw: string | undefined, now = Date.now()): ReportMonth {
  const cur = currentMonth(now);
  const m = raw ? MONTH_RE.exec(raw) : null;
  if (!m) return cur;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (y < MIN_YEAR || y * 12 + mo > cur.y * 12 + cur.m) return cur;
  return monthOf(y, mo);
}

export function shiftMonth(base: ReportMonth, delta: number): ReportMonth {
  const idx = base.y * 12 + (base.m - 1) + delta;
  return monthOf(Math.floor(idx / 12), (idx % 12) + 1);
}

/** Tanlov ro'yxati: joriy oydan orqaga `count` ta oy */
export function recentMonths(count = 24, now = Date.now()): ReportMonth[] {
  const cur = currentMonth(now);
  const out: ReportMonth[] = [];
  for (let i = 0; i < count; i++) {
    const mo = shiftMonth(cur, -i);
    if (mo.y < MIN_YEAR) break;
    out.push(mo);
  }
  return out;
}

export async function loadMonthlyReport(specialistId: string, month: ReportMonth) {
  const from = new Date(month.startMs);
  const to = new Date(month.endMs);

  const [completed, released, payoutRows, subs] = await Promise.all([
    db
      .select({ id: orders.id, title: orders.title, amount: orders.amount, completedAt: orders.completedAt, paymentState: orders.paymentState })
      .from(orders)
      .where(and(eq(orders.specialistId, specialistId), eq(orders.status, "done"), gte(orders.completedAt, from), lt(orders.completedAt, to)))
      .orderBy(asc(orders.completedAt)),
    db
      .select({
        id: payments.id,
        orderId: payments.orderId,
        orderTitle: orders.title,
        amount: payments.amount,
        commissionPct: payments.commissionPct,
        commissionAmount: payments.commissionAmount,
        netAmount: payments.netAmount,
        releasedAt: payments.releasedAt,
      })
      .from(payments)
      .innerJoin(orders, eq(payments.orderId, orders.id))
      .where(and(eq(payments.specialistId, specialistId), eq(payments.state, "released"), gte(payments.releasedAt, from), lt(payments.releasedAt, to)))
      .orderBy(asc(payments.releasedAt)),
    // Shu oyda so'ralgan YOKI shu oyda to'langan payoutlar
    db
      .select({ id: payouts.id, amount: payouts.amount, state: payouts.state, method: payouts.method, createdAt: payouts.createdAt, processedAt: payouts.processedAt })
      .from(payouts)
      .where(
        and(
          eq(payouts.specialistId, specialistId),
          or(and(gte(payouts.createdAt, from), lt(payouts.createdAt, to)), and(gte(payouts.processedAt, from), lt(payouts.processedAt, to))),
        ),
      )
      .orderBy(asc(payouts.createdAt)),
    db
      .select({
        id: subscriptionInvoices.id,
        months: subscriptionInvoices.months,
        amount: subscriptionInvoices.amount,
        provider: subscriptionInvoices.provider,
        paidAt: subscriptionInvoices.paidAt,
        periodStart: subscriptionInvoices.periodStart,
        periodEnd: subscriptionInvoices.periodEnd,
      })
      .from(subscriptionInvoices)
      .where(
        and(
          eq(subscriptionInvoices.specialistId, specialistId),
          eq(subscriptionInvoices.state, "paid"),
          gte(subscriptionInvoices.paidAt, from),
          lt(subscriptionInvoices.paidAt, to),
        ),
      )
      .orderBy(asc(subscriptionInvoices.paidAt)),
  ]);

  const gross = released.reduce((s, p) => s + p.amount, 0);
  const commission = released.reduce((s, p) => s + p.commissionAmount, 0);
  const net = released.reduce((s, p) => s + p.netAmount, 0);
  const payoutsPaid = payoutRows.filter((p) => p.state === "paid" && p.processedAt && p.processedAt >= from && p.processedAt < to).reduce((s, p) => s + p.amount, 0);
  const subscriptionPaid = subs.reduce((s, x) => s + x.amount, 0);

  return {
    completed,
    released,
    payouts: payoutRows,
    subscriptions: subs,
    totals: { completedCount: completed.length, gross, commission, net, payoutsPaid, subscriptionPaid, netAfterSubscription: net - subscriptionPaid },
  };
}
