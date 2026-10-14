import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { specialists, subscriptionInvoices, users, type SubscriptionInvoice } from "@/lib/db/schema";
import type { PaymentProvider } from "@/lib/constants";
import { availableProviders } from "@/lib/payments/config";
import { getSettings, type PlatformSettings } from "@/lib/payments/settings";
import { subscriptionState, type SubscriptionStatus, type SubscriptionSubject } from "./access";
import { isProviderInFlight, lastPaidInvoice, listInvoicesForSpecialist, manualRequisites, plansFor, toInvoiceView } from "./billing";
import type { InvoiceView, PlanView } from "./labels";
import type { AdminSubFilter } from "./schemas";

const DAY = 86_400_000;

/** Mijozga yuboriladigan obuna holati (Date → ms) */
export interface SubscriptionStateView {
  status: SubscriptionStatus;
  until: number;
  graceUntil: number;
  daysLeft: number;
  paid: boolean;
  /** Joriy davr uzunligi (kun) — progress halqasi uchun */
  periodDays: number;
}

export interface SubscriptionOverview {
  state: SubscriptionStateView;
  price: number;
  trialDays: number;
  graceDays: number;
  enforced: boolean;
  plans: PlanView[];
  invoices: InvoiceView[];
  providers: PaymentProvider[];
  manual: { card: string; name: string } | null;
}

export function stateView(sp: SubscriptionSubject, settings: PlatformSettings, last: Pick<SubscriptionInvoice, "periodStart" | "periodEnd"> | null, now = new Date()): SubscriptionStateView {
  const st = subscriptionState(sp, settings, now);
  let periodDays: number;
  if (st.status === "grace") periodDays = Math.max(1, settings.subscriptionGraceDays);
  else if (!st.paid) periodDays = Math.max(1, settings.subscriptionTrialDays);
  else if (last?.periodStart && last.periodEnd) periodDays = Math.max(1, Math.round((last.periodEnd.getTime() - last.periodStart.getTime()) / DAY));
  else periodDays = 30;
  return { status: st.status, until: st.until.getTime(), graceUntil: st.graceUntil.getTime(), daysLeft: st.daysLeft, paid: st.paid, periodDays: Math.max(periodDays, st.daysLeft) };
}

/** Mutaxassisning obuna sahifasi / GET /api/subscription uchun to'liq ma'lumot */
export async function getSubscriptionOverview(sp: SubscriptionSubject & { id: string }): Promise<SubscriptionOverview> {
  const [settings, invoices, last] = await Promise.all([getSettings(), listInvoicesForSpecialist(sp.id, 50), lastPaidInvoice(sp.id)]);
  return {
    state: stateView(sp, settings, last),
    price: settings.subscriptionPrice,
    trialDays: settings.subscriptionTrialDays,
    graceDays: settings.subscriptionGraceDays,
    enforced: settings.subscriptionEnforced === 1,
    plans: plansFor(settings),
    invoices: invoices.map(toInvoiceView),
    providers: await availableProviders(),
    manual: await manualRequisites(),
  };
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */
export interface AdminSubscriberRow {
  specialistId: string;
  slug: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  title: string;
  isBanned: boolean;
  status: SubscriptionStatus;
  until: number;
  graceUntil: number;
  daysLeft: number;
  paid: boolean;
  lastPaidAt: number | null;
  lastAmount: number | null;
  totalPaid: number;
  invoiceCount: number;
}

export interface AdminInvoiceRow extends InvoiceView {
  specialistId: string | null;
  specialistName: string | null;
  specialistSlug: string | null;
  providerTxnId: string | null;
  sentAt: number | null;
  /** Payme/Click tomonida jarayonda (12 soatdan yangi) — admin bekor qila olmaydi */
  inFlight: boolean;
}

export interface AdminSubscriptionTotals {
  revenueMonth: number;
  revenueTotal: number;
  /** Joriy davri ichidagi to'langan hisoblar: Σ summa / oylar */
  mrr: number;
  active: number;
  trial: number;
  grace: number;
  expired: number;
  off: number;
  pendingManual: number;
  price: number;
  enforced: boolean;
}

export interface AdminSubscriptionData {
  totals: AdminSubscriptionTotals;
  subscribers: AdminSubscriberRow[];
  total: number;
  page: number;
  pages: number;
  invoices: AdminInvoiceRow[];
}

/** Toshkent vaqti bo'yicha joriy oy boshi (UTC+5, yozgi vaqt yo'q) */
function tashkentMonthStart(now: number): number {
  const tz = 5 * 60 * 60 * 1000;
  const d = new Date(now + tz);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - tz;
}

/** Admin bosh sahifasi plitkasi uchun yengil agregat (getAdminSubscriptionData barcha profillarni yuklaydi) */
export async function getSubscriptionRevenueSummary(now = Date.now()): Promise<{ revenueMonth: number; revenueTotal: number; paidCount: number; pendingManual: number }> {
  const monthStart = tashkentMonthStart(now);
  const [paid] = await db
    .select({
      total: sql<number>`coalesce(sum(${subscriptionInvoices.amount}), 0)`,
      month: sql<number>`coalesce(sum(case when ${subscriptionInvoices.paidAt} >= ${monthStart} then ${subscriptionInvoices.amount} else 0 end), 0)`,
      n: sql<number>`count(*)`,
    })
    .from(subscriptionInvoices)
    .where(eq(subscriptionInvoices.state, "paid"));
  const [pending] = await db
    .select({ n: sql<number>`count(*)` })
    .from(subscriptionInvoices)
    .where(and(eq(subscriptionInvoices.state, "pending"), eq(subscriptionInvoices.provider, "manual")));
  return { revenueMonth: Number(paid?.month ?? 0), revenueTotal: Number(paid?.total ?? 0), paidCount: Number(paid?.n ?? 0), pendingManual: Number(pending?.n ?? 0) };
}

/** Admin ro'yxati: harakat talab qiladiganlar tepada — tugagan (katalogdan yashirin), keyin muhlatdagi, sinov, faol */
const STATUS_RANK: Record<SubscriptionStatus, number> = { expired: 0, grace: 1, trial: 2, active: 3, off: 4 };
const PER_PAGE = 25;

export async function getAdminSubscriptionData(filter: { status?: AdminSubFilter; q?: string; page?: number; invoices?: "all" | "pending" | "paid" | "refunded" | "cancelled" } = {}): Promise<AdminSubscriptionData> {
  const settings = await getSettings();
  const now = new Date();
  const t = now.getTime();
  const [rows, paid, pendingManual] = await Promise.all([
    db
      .select({
        id: specialists.id,
        slug: specialists.slug,
        title: specialists.title,
        createdAt: specialists.createdAt,
        subscriptionUntil: specialists.subscriptionUntil,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl,
        isBanned: users.isBanned,
      })
      .from(specialists)
      .innerJoin(users, eq(users.id, specialists.userId)),
    db.query.subscriptionInvoices.findMany({
      where: eq(subscriptionInvoices.state, "paid"),
      columns: { specialistId: true, amount: true, months: true, paidAt: true, periodStart: true, periodEnd: true },
      orderBy: [desc(subscriptionInvoices.paidAt)],
    }),
    db.query.subscriptionInvoices.findMany({
      where: and(eq(subscriptionInvoices.state, "pending"), eq(subscriptionInvoices.provider, "manual")),
      columns: { id: true },
    }),
  ]);

  // To'lovlar bo'yicha agregatlar (paidAt kamayish tartibida — birinchisi so'nggi to'lov)
  const agg = new Map<string, { last: number | null; lastAmount: number; total: number; count: number }>();
  const monthStart = tashkentMonthStart(t);
  let revenueMonth = 0;
  let revenueTotal = 0;
  let mrr = 0;
  for (const p of paid) {
    revenueTotal += p.amount;
    if (p.paidAt && p.paidAt.getTime() >= monthStart) revenueMonth += p.amount;
    if (p.periodStart && p.periodEnd && p.periodStart.getTime() <= t && p.periodEnd.getTime() > t) mrr += p.amount / Math.max(1, p.months);
    if (!p.specialistId) continue;
    const a = agg.get(p.specialistId);
    if (a) {
      a.total += p.amount;
      a.count++;
    } else agg.set(p.specialistId, { last: p.paidAt?.getTime() ?? null, lastAmount: p.amount, total: p.amount, count: 1 });
  }

  const counts: Record<SubscriptionStatus, number> = { active: 0, trial: 0, grace: 0, expired: 0, off: 0 };
  const all: AdminSubscriberRow[] = rows.map((r) => {
    const st = subscriptionState(r, settings, now);
    counts[st.status]++;
    const a = agg.get(r.id);
    return {
      specialistId: r.id,
      slug: r.slug,
      name: r.name,
      email: r.email,
      avatarUrl: r.avatarUrl,
      title: r.title,
      isBanned: r.isBanned,
      status: st.status,
      until: st.until.getTime(),
      graceUntil: st.graceUntil.getTime(),
      daysLeft: st.daysLeft,
      paid: st.paid,
      lastPaidAt: a?.last ?? null,
      lastAmount: a?.lastAmount ?? null,
      totalPaid: a?.total ?? 0,
      invoiceCount: a?.count ?? 0,
    };
  });

  const q = filter.q?.toLowerCase().trim();
  const status = filter.status ?? "all";
  const filtered = all
    .filter((r) => status === "all" || r.status === status)
    .filter((r) => !q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.slug.includes(q))
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || (a.status === "expired" ? b.until - a.until : a.until - b.until));
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const page = Math.min(Math.max(1, filter.page ?? 1), pages);

  const invoiceFilter = filter.invoices ?? "all";
  const invoiceRows = await db.query.subscriptionInvoices.findMany({
    where:
      invoiceFilter === "all"
          ? inArray(subscriptionInvoices.state, ["pending", "paid", "refunded"])
          : eq(subscriptionInvoices.state, invoiceFilter),
    orderBy: [desc(subscriptionInvoices.updatedAt)],
    limit: 40,
    with: { specialist: { columns: { id: true, slug: true }, with: { user: { columns: { name: true } } } } },
  });

  return {
    totals: {
      revenueMonth,
      revenueTotal,
      mrr: Math.round(mrr),
      ...counts,
      pendingManual: pendingManual.length,
      price: settings.subscriptionPrice,
      enforced: settings.subscriptionEnforced === 1,
    },
    subscribers: filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    total: filtered.length,
    page,
    pages,
    invoices: invoiceRows.map((i) => ({
      ...toInvoiceView(i),
      specialistId: i.specialistId,
      specialistName: i.specialist?.user.name ?? null,
      specialistSlug: i.specialist?.slug ?? null,
      providerTxnId: i.providerTxnId,
      sentAt: typeof i.meta.sentAt === "number" ? i.meta.sentAt : null,
      inFlight: isProviderInFlight(i, t),
    })),
  };
}
