import "server-only";
import { and, desc, eq, gte, inArray, isNotNull, or, sql, type AnyColumn } from "drizzle-orm";
import { db } from "@/lib/db";
import { contactUnlocks, dmMessages, feedbacks, mentorPayouts, mentors, orders, payments, payouts, postComments, posts, reports, reviews, specialists, stories, subscriptionInvoices, users } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { bumpSessionVersion } from "@/lib/auth";
import { notify, notifyAdmins } from "@/lib/notifications";
import { audit } from "@/lib/security/audit";
import { rateLimit } from "@/lib/security/rate-limit";
import { siteUrl } from "@/lib/security/site";
import { cutPlain, escapeTelegramHtml, sendTelegram, telegramApi, type TelegramButton } from "@/lib/telegram";
import { formatPrice } from "@/lib/utils";
import { tashkentDayStart } from "@/lib/jobs/server";
import { purchaseMeta } from "@/lib/mentorship/purchases";
import { contactMeta, isContactUnlock } from "@/lib/contacts/unlock";
import { appUrl, menuRows } from "@/lib/telegram-bot/ui";
import { listAdminReports, type AdminReportRow } from "@/app/admin/queries";
import { listPendingMentors, setMentorApproved } from "@/lib/mentorship/service";
import { deleteComment, deletePost } from "@/lib/groups/service";
import { recalcRating } from "@/lib/queries";
import { listOpenDisputes } from "@/lib/payments/disputes";
import { getSpecialistBalance, listAdminPayouts, specialistOwnerId } from "@/lib/payments/queries";
import { PAYOUT_STATE_LABEL } from "@/lib/constants";
import { adminTwoFactorRequired } from "@/lib/security/admin-2fa";
import { L, type BotLang } from "@/lib/telegram-bot/lang";
import { likeAny, userIdsByPhone } from "@/lib/telegram-bot/text-search";

/**
 * ADMIN BOTI (2026-10-31): administrator Telegramdan platformani kuzatadi va navbatni hal qiladi.
 *  /admin  — menyu (statistika · navbat · to'lovlar · foydalanuvchi · e'lon · admin panel)
 *  /stat   — statistika: bugun / 7 kun / 30 kun (tugmalar bilan almashadi, `adm:stat:<davr>`)
 *  /navbat — tasdiq kutayotganlar: mutaxassislar («✅ Tasdiqlash» `adm:ver:<id>`), qo'lda o'tkazmalar (`mp:` tugmalari),
 *            shikoyatlar, nizolar, payout so'rovlari, mentor arizalari (havolalar bilan)
 *  /tolovlar — kutilayotgan qo'lda o'tkazmalar, har biri tasdiqlash/rad etish tugmalari bilan
 *  /user <ism|email|@taxallus> — foydalanuvchi qidirish; bloklash / blokdan chiqarish (`adm:ban|unban:<id>`)
 *  Kunlik hisobot: cron (q) — har admin Telegramiga kechagi kun statistikasi + navbat (bir kunda bir marta).
 * QOIDA: har amal chatga ulangan hisobning admin roli bilan tekshiriladi; tugma havolasi boshqaga tushsa ishlamaydi.
 * TIL (2026-11-04): har funksiya `lang` (webhook `who.lang`, cron — `users.lang`) oladi; matnlar `L(lang, uz, ru)` — uz matni o'zgarmagan.
 */
type Answer = (text: string) => Promise<unknown>;
export type StatPeriod = "today" | "7d" | "30d";
const PERIOD_LABEL: Record<StatPeriod, string> = { today: "Bugun", "7d": "7 kun", "30d": "30 kun" };
const PERIOD_LABEL_RU: Record<StatPeriod, string> = { today: "Сегодня", "7d": "7 дней", "30d": "30 дней" };
const periodLabel = (p: StatPeriod, lang?: BotLang) => (lang === "ru" ? PERIOD_LABEL_RU : PERIOD_LABEL)[p];
const HOUR = 3600_000;
const DAY = 24 * HOUR;
const site = () => siteUrl() ?? "";
const n = (v: unknown) => Number(v ?? 0);

/** Chatga ulangan ADMIN (bo'lmasa null) */
export async function adminByChat(chatId: string): Promise<{ id: string; name: string } | null> {
  const u = await db.query.users.findFirst({ where: eq(users.telegramChatId, chatId), columns: { id: true, name: true, role: true, isBanned: true, totpEnabled: true } });
  // ADMIN_REQUIRE_2FA=1 — 2FA'siz admin bot orqali ham admin amallarini bajara olmaydi (security/admin-2fa.ts)
  if (u && adminTwoFactorRequired() && !u.totpEnabled) return null;
  return u && u.role === "admin" && !u.isBanned ? { id: u.id, name: u.name } : null;
}

/** Admin panel tugmasi: https bo'lsa Mini App, bo'lmasa oddiy havola */
function panelButton(path = "/admin", text = "🛠 Admin panel"): TelegramButton {
  // (ruscha ham «🛠 Админ-панель» — chaqiruvchi L() bilan beradi; standart matn uz/ru da deyarli bir xil)
  const app = appUrl(path);
  return app ? { text, webApp: app } : { text, url: `${site()}${path}` };
}

/* ------------------------------------------------------------------ */
/* Statistika                                                          */
/* ------------------------------------------------------------------ */
export interface AdminStats {
  period: StatPeriod;
  from: number;
  to: number;
  users: { total: number; newTotal: number; newSpecialists: number; newClients: number; active: number; telegram: number };
  specialists: { listed: number; verified: number; pending: number };
  orders: { created: number; done: number; escrowPaid: number; commission: number };
  revenue: { subscriptions: number; contacts: number; contactsCount: number; mentorship: number; total: number };
  content: { posts: number; stories: number; dms: number };
  queue: { pendingSpecialists: number; manualPayments: number; manualInvoices: number; reports: number; disputes: number; payouts: number; mentorPayouts: number; mentorApps: number; verifyRequests?: number };
}

export function periodRange(period: StatPeriod, now = Date.now()): { from: number; to: number } {
  if (period === "today") return { from: tashkentDayStart(now), to: now };
  return { from: now - (period === "7d" ? 7 : 30) * DAY, to: now };
}

/** Kechagi to'liq kun (Toshkent) — kunlik hisobot uchun */
export function yesterdayRange(now = Date.now()): { from: number; to: number } {
  const today = tashkentDayStart(now);
  return { from: today - DAY, to: today };
}

/** Taqqoslash uchun oldingi davr: bugun → kecha shu vaqtgacha; 7/30 kun → undan oldingi 7/30 kun */
export function prevRange(period: StatPeriod, now = Date.now()): { from: number; to: number } {
  const r = periodRange(period, now);
  if (period === "today") return { from: r.from - DAY, to: now - DAY };
  return { from: r.from - (r.to - r.from), to: r.from };
}

export async function collectAdminStats(period: StatPeriod, range: { from: number; to: number } = periodRange(period)): Promise<AdminStats> {
  const { from, to } = range;
  const fromD = new Date(from);
  // Xom SQL ichida sana EMAS, millisekund soni ishlatiladi (timestamp_ms ustunlari butun son; libsql Date'ni matnga aylantirib yuboradi)
  const inRange = (col: AnyColumn) => sql`${col} >= ${from} and ${col} < ${to}`;
  const [u, s, o, p, inv, c, posts1, stories1, dms, q] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)`,
        newTotal: sql<number>`sum(case when ${users.createdAt} >= ${from} and ${users.createdAt} < ${to} then 1 else 0 end)`,
        newSpecialists: sql<number>`sum(case when ${users.createdAt} >= ${from} and ${users.createdAt} < ${to} and ${users.role} = 'specialist' then 1 else 0 end)`,
        newClients: sql<number>`sum(case when ${users.createdAt} >= ${from} and ${users.createdAt} < ${to} and ${users.role} = 'client' then 1 else 0 end)`,
        active: sql<number>`sum(case when ${users.lastSeenAt} >= ${from} then 1 else 0 end)`,
        telegram: sql<number>`sum(case when ${users.telegramChatId} is not null then 1 else 0 end)`,
      })
      .from(users)
      .then((r) => r[0]),
    db
      .select({
        listed: sql<number>`sum(case when ${specialists.isHidden} = 0 then 1 else 0 end)`,
        verified: sql<number>`sum(case when ${specialists.isVerified} = 1 then 1 else 0 end)`,
        pending: sql<number>`sum(case when ${specialists.isVerified} = 0 and ${specialists.isHidden} = 0 then 1 else 0 end)`,
      })
      .from(specialists)
      .then((r) => r[0]),
    db
      .select({
        created: sql<number>`sum(case when ${orders.createdAt} >= ${from} and ${orders.createdAt} < ${to} then 1 else 0 end)`,
        done: sql<number>`sum(case when ${orders.status} = 'done' and ${orders.updatedAt} >= ${from} and ${orders.updatedAt} < ${to} then 1 else 0 end)`,
      })
      .from(orders)
      .then((r) => r[0]),
    db
      .select({
        escrowPaid: sql<number>`coalesce(sum(case when ${payments.state} in ('paid','released') then ${payments.amount} else 0 end), 0)`,
        commission: sql<number>`coalesce(sum(case when ${payments.state} in ('paid','released') then ${payments.commissionAmount} else 0 end), 0)`,
      })
      .from(payments)
      .where(inRange(payments.createdAt))
      .then((r) => r[0]),
    db
      .select({
        subscriptions: sql<number>`coalesce(sum(case when json_extract(${subscriptionInvoices.meta}, '$.kind') is null or json_extract(${subscriptionInvoices.meta}, '$.kind') not in ('purchase','contact') then ${subscriptionInvoices.amount} else 0 end), 0)`,
        mentorship: sql<number>`coalesce(sum(case when json_extract(${subscriptionInvoices.meta}, '$.kind') = 'purchase' then ${subscriptionInvoices.amount} else 0 end), 0)`,
      })
      .from(subscriptionInvoices)
      .where(and(eq(subscriptionInvoices.state, "paid"), gte(subscriptionInvoices.paidAt, fromD), sql`${subscriptionInvoices.paidAt} < ${to}`))
      .then((r) => r[0]),
    db
      .select({ count: sql<number>`count(*)`, sum: sql<number>`coalesce(sum(${contactUnlocks.amount}), 0)` })
      .from(contactUnlocks)
      .where(and(eq(contactUnlocks.status, "paid"), gte(contactUnlocks.paidAt, fromD), sql`${contactUnlocks.paidAt} < ${to}`))
      .then((r) => r[0]),
    db.select({ c: sql<number>`count(*)` }).from(posts).where(inRange(posts.createdAt)).then((r) => r[0]),
    db.select({ c: sql<number>`count(*)` }).from(stories).where(inRange(stories.createdAt)).then((r) => r[0]),
    db.select({ c: sql<number>`count(*)` }).from(dmMessages).where(inRange(dmMessages.createdAt)).then((r) => r[0]),
    collectQueueCounts(),
  ]);
  const revenue = { subscriptions: n(inv?.subscriptions), contacts: n(c?.sum), contactsCount: n(c?.count), mentorship: n(inv?.mentorship), total: 0 };
  revenue.total = revenue.subscriptions + revenue.contacts + revenue.mentorship + n(p?.commission);
  return {
    period,
    from,
    to,
    users: { total: n(u?.total), newTotal: n(u?.newTotal), newSpecialists: n(u?.newSpecialists), newClients: n(u?.newClients), active: n(u?.active), telegram: n(u?.telegram) },
    specialists: { listed: n(s?.listed), verified: n(s?.verified), pending: n(s?.pending) },
    orders: { created: n(o?.created), done: n(o?.done), escrowPaid: n(p?.escrowPaid), commission: n(p?.commission) },
    revenue,
    content: { posts: n(posts1?.c), stories: n(stories1?.c), dms: n(dms?.c) },
    queue: q,
  };
}

export async function collectQueueCounts(): Promise<AdminStats["queue"]> {
  const [sp, mp, mi, rp, ds, po, mpo, ma] = await Promise.all([
    db.select({ c: sql<number>`count(*)` }).from(specialists).where(and(eq(specialists.isVerified, false), eq(specialists.isHidden, false))).then((r) => n(r[0]?.c)),
    db.select({ c: sql<number>`count(*)` }).from(payments).where(and(eq(payments.state, "pending"), eq(payments.provider, "manual"))).then((r) => n(r[0]?.c)),
    db.select({ c: sql<number>`count(*)` }).from(subscriptionInvoices).where(and(eq(subscriptionInvoices.state, "pending"), eq(subscriptionInvoices.provider, "manual"))).then((r) => n(r[0]?.c)),
    db.select({ c: sql<number>`count(*)` }).from(reports).where(eq(reports.status, "open")).then((r) => n(r[0]?.c)),
    db.select({ c: sql<number>`count(*)` }).from(orders).where(eq(orders.disputeState, "open")).then((r) => n(r[0]?.c)),
    db.select({ c: sql<number>`count(*)` }).from(payouts).where(eq(payouts.state, "requested")).then((r) => n(r[0]?.c)),
    db.select({ c: sql<number>`count(*)` }).from(mentorPayouts).where(eq(mentorPayouts.status, "requested")).then((r) => n(r[0]?.c)),
    db.select({ c: sql<number>`count(*)` }).from(mentors).where(and(eq(mentors.isApproved, false), isNotNull(mentors.appliedAt))).then((r) => n(r[0]?.c)),
  ]);
  // Ko'k belgi so'rovi yuborganlar (lib/verification.ts) — /navbat'da birinchi ko'rsatiladi
  const vr = await db.select({ c: sql<number>`count(*)` }).from(specialists).where(and(eq(specialists.isVerified, false), isNotNull(specialists.verificationRequestedAt))).then((r) => n(r[0]?.c));
  return { pendingSpecialists: sp, manualPayments: mp, manualInvoices: mi, reports: rp, disputes: ds, payouts: po, mentorPayouts: mpo, mentorApps: ma, verifyRequests: vr };
}

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit", timeZone: "Asia/Tashkent" });

/* ------------------------------------------------------------------ */
/* Trend: kunlik seriya, mini-grafik, oldingi davrga nisbatan o'zgarish */
/* ------------------------------------------------------------------ */
const TZ_MS = 5 * HOUR;
export interface DailyPoint {
  day: string;
  users: number;
  orders: number;
  posts: number;
  revenue: number;
}

/** Oxirgi `days` kun (Toshkent kunlari, `now` kuni bilan tugaydi): yangi foydalanuvchi, buyurtma, post, tushum */
export async function collectDailySeries(days = 7, now = Date.now()): Promise<DailyPoint[]> {
  const from = tashkentDayStart(now) - (days - 1) * DAY;
  // Kun indeksi = (ms + 5 soat) / kun — timestamp_ms ustunlari butun son, Date EMAS
  const dayOf = (col: AnyColumn) => sql<number>`cast((${col} + ${TZ_MS}) / ${DAY} as integer)`;
  const [u, o, p, inv, cu, pay] = await Promise.all([
    db.select({ d: dayOf(users.createdAt), v: sql<number>`count(*)` }).from(users).where(sql`${users.createdAt} >= ${from}`).groupBy(dayOf(users.createdAt)),
    db.select({ d: dayOf(orders.createdAt), v: sql<number>`count(*)` }).from(orders).where(sql`${orders.createdAt} >= ${from}`).groupBy(dayOf(orders.createdAt)),
    db.select({ d: dayOf(posts.createdAt), v: sql<number>`count(*)` }).from(posts).where(sql`${posts.createdAt} >= ${from}`).groupBy(dayOf(posts.createdAt)),
    // Obuna + mentorlik hisoblari (kontakt — contact_unlocks jadvalidan, ikki marta sanalmasin)
    db
      .select({ d: dayOf(subscriptionInvoices.paidAt), v: sql<number>`coalesce(sum(${subscriptionInvoices.amount}), 0)` })
      .from(subscriptionInvoices)
      .where(and(eq(subscriptionInvoices.state, "paid"), sql`${subscriptionInvoices.paidAt} >= ${from}`, sql`coalesce(json_extract(${subscriptionInvoices.meta}, '$.kind'), '') <> 'contact'`))
      .groupBy(dayOf(subscriptionInvoices.paidAt)),
    db
      .select({ d: dayOf(contactUnlocks.paidAt), v: sql<number>`coalesce(sum(${contactUnlocks.amount}), 0)` })
      .from(contactUnlocks)
      .where(and(eq(contactUnlocks.status, "paid"), sql`${contactUnlocks.paidAt} >= ${from}`))
      .groupBy(dayOf(contactUnlocks.paidAt)),
    db
      .select({ d: dayOf(payments.createdAt), v: sql<number>`coalesce(sum(${payments.commissionAmount}), 0)` })
      .from(payments)
      .where(and(sql`${payments.state} in ('paid','released')`, sql`${payments.createdAt} >= ${from}`))
      .groupBy(dayOf(payments.createdAt)),
  ]);
  const firstIdx = Math.floor((from + TZ_MS) / DAY);
  const points: DailyPoint[] = [];
  const byIdx = new Map<number, DailyPoint>();
  for (let i = 0; i < days; i++) {
    const pt: DailyPoint = { day: fmtDate(from + i * DAY), users: 0, orders: 0, posts: 0, revenue: 0 };
    byIdx.set(firstIdx + i, pt);
    points.push(pt);
  }
  const add = (rows: { d: number; v: number }[], key: "users" | "orders" | "posts" | "revenue") => {
    for (const r of rows) {
      const pt = byIdx.get(Number(r.d));
      if (pt) pt[key] += n(r.v);
    }
  };
  add(u, "users");
  add(o, "orders");
  add(p, "posts");
  add(inv, "revenue");
  add(cu, "revenue");
  add(pay, "revenue");
  return points;
}

const BARS = "▁▂▃▄▅▆▇█";
/** Unicode ustunli mini-grafik: 0 → eng past, maksimum → eng baland */
export function sparkline(values: number[]): string {
  const max = Math.max(0, ...values);
  if (max <= 0) return BARS[0].repeat(values.length);
  return values.map((v) => BARS[Math.max(0, Math.min(7, Math.round((v / max) * 7)))]).join("");
}
/** Oldingi davrga nisbatan: «▲ 25%», «▼ 10%», «=», «▲ yangi» */
export function trend(cur: number, prev: number, lang?: BotLang): string {
  if (prev <= 0) return cur > 0 ? L(lang, "▲ yangi", "▲ новое") : "=";
  const pct = Math.round(((cur - prev) / prev) * 100);
  return pct === 0 ? "=" : `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct)}%`;
}
const shortSum = (v: number, lang?: BotLang) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")} ${L(lang, "mln", "млн")}` : v >= 1000 ? `${Math.round(v / 1000)} ${L(lang, "ming", "тыс.")}` : String(v));
const sumOf = (sr: DailyPoint[], key: keyof Omit<DailyPoint, "day">) => sr.reduce((a, x) => a + x[key], 0);

/** `cmp.prev` — oldingi davr (qavsda ▲/▼ foiz), `cmp.series` — kunlik trend (mini-grafik) */
export function renderStats(s: AdminStats, title?: string, cmp?: { prev?: AdminStats; series?: DailyPoint[] }, lang?: BotLang): string {
  const q = s.queue;
  const queueTotal = q.pendingSpecialists + q.manualPayments + q.manualInvoices + q.reports + q.disputes + q.payouts + q.mentorPayouts + q.mentorApps;
  const head = title ?? `📊 <b>${L(lang, "Statistika", "Статистика")} — ${periodLabel(s.period, lang)}</b> (${s.period === "today" ? fmtDate(s.to) : `${fmtDate(s.from)} – ${fmtDate(s.to)}`})`;
  const d = (cur: number, pick: (x: AdminStats) => number) => (cmp?.prev ? ` (${trend(cur, pick(cmp.prev), lang)})` : "");
  const lines = [
    head,
    "",
    `👥 <b>${L(lang, "Foydalanuvchilar", "Пользователи")}:</b> +${s.users.newTotal}${d(s.users.newTotal, (x) => x.users.newTotal)} (${L(lang, "jami", "всего")} ${s.users.total}) · ${L(lang, "mutaxassis", "специалисты")} +${s.users.newSpecialists} · ${L(lang, "mijoz", "клиенты")} +${s.users.newClients}`,
    `🟢 ${L(lang, "Faol", "Активные")}: ${s.users.active} · ${L(lang, "Telegram ulangan", "Подключили Telegram")}: ${s.users.telegram}`,
    `🎨 <b>${L(lang, "Mutaxassislar", "Специалисты")}:</b> ${s.specialists.listed} ${L(lang, "katalogda", "в каталоге")} · ${s.specialists.verified} ${L(lang, "tasdiqlangan", "подтверждено")} · ${s.specialists.pending} ${L(lang, "tasdiq kutmoqda", "ждут подтверждения")}`,
    `📦 <b>${L(lang, "Buyurtmalar", "Заказы")}:</b> ${s.orders.created} ${L(lang, "yangi", "новых")}${d(s.orders.created, (x) => x.orders.created)} · ${s.orders.done} ${L(lang, "bajarildi", "выполнено")} · ${L(lang, "eskrou", "эскроу")} ${formatPrice(s.orders.escrowPaid)}`,
    `💰 <b>${L(lang, "Tushum", "Выручка")}:</b> ${formatPrice(s.revenue.total)}${d(s.revenue.total, (x) => x.revenue.total)}`,
    `   ${L(lang, "obuna", "подписки")} ${formatPrice(s.revenue.subscriptions)} · ${L(lang, "kontakt", "контакты")} ${formatPrice(s.revenue.contacts)} (${s.revenue.contactsCount} ${L(lang, "ta", "шт.")}) · ${L(lang, "mentorlik", "менторство")} ${formatPrice(s.revenue.mentorship)} · ${L(lang, "komissiya", "комиссия")} ${formatPrice(s.orders.commission)}`,
    `📝 <b>${L(lang, "Kontent", "Контент")}:</b> ${s.content.posts} ${L(lang, "post", "постов")}${d(s.content.posts, (x) => x.content.posts)} · ${s.content.stories} story · ${s.content.dms} ${L(lang, "xabar", "сообщений")}`,
  ];
  if (cmp?.prev) lines.push(lang === "ru" ? `<i>В скобках — по сравнению с ${s.period === "today" ? "тем же временем вчера" : "предыдущими " + PERIOD_LABEL_RU[s.period].replace("дней", "днями")}</i>` : `<i>Qavsda — oldingi ${s.period === "today" ? "kunning shu vaqtiga" : PERIOD_LABEL[s.period] + "ga"} nisbatan</i>`);
  const sr = cmp?.series;
  if (sr?.length) {
    lines.push(
      "",
      `📈 <b>${L(lang, "Trend", "Тренд")} — ${sr.length} ${L(lang, "kun", "дн.")}</b> (${sr[0].day} → ${sr[sr.length - 1].day})`,
      `👥 ${sparkline(sr.map((x) => x.users))} ${sumOf(sr, "users")} ${L(lang, "foydalanuvchi", "пользователей")}`,
      `📦 ${sparkline(sr.map((x) => x.orders))} ${sumOf(sr, "orders")} ${L(lang, "buyurtma", "заказов")}`,
      `📝 ${sparkline(sr.map((x) => x.posts))} ${sumOf(sr, "posts")} ${L(lang, "post", "постов")}`,
      `💰 ${sparkline(sr.map((x) => x.revenue))} ${shortSum(sumOf(sr, "revenue"), lang)} ${L(lang, "so'm tushum", "сум выручки")}`,
    );
  }
  lines.push("", `📥 <b>${L(lang, "Navbat", "Очередь")} (${queueTotal}):</b> ${q.pendingSpecialists} ${L(lang, "tasdiq", "подтв.")} · ${q.manualPayments + q.manualInvoices} ${L(lang, "o'tkazma", "переводов")} · ${q.reports} ${L(lang, "shikoyat", "жалоб")} · ${q.disputes} ${L(lang, "nizo", "споров")} · ${q.payouts + q.mentorPayouts} ${L(lang, "payout", "выплат")} · ${q.mentorApps} ${L(lang, "mentor arizasi", "заявок менторов")}`);
  return lines.join("\n");
}

function statsKeyboard(period: StatPeriod, lang?: BotLang): TelegramButton[][] {
  const periods = (["today", "7d", "30d"] as StatPeriod[]).map((p) => ({ text: p === period ? `• ${periodLabel(p, lang)} •` : periodLabel(p, lang), data: `adm:stat:${p}` }));
  return [periods, [{ text: L(lang, "📥 Navbat", "📥 Очередь"), data: "adm:queue" }, { text: L(lang, "💳 To'lovlar", "💳 Платежи"), data: "adm:pay" }], [{ text: L(lang, "🚩 Shikoyatlar", "🚩 Жалобы"), data: "adm:reports" }, { text: L(lang, "🎓 Mentorlar", "🎓 Менторы"), data: "adm:mentors" }], [panelButton("/admin", PANEL(lang))]];
}
/** «Admin panel» tugmasi matni */
const PANEL = (lang?: BotLang) => L(lang, "🛠 Admin panel", "🛠 Админ-панель");
const SEE_ALL = (lang?: BotLang) => L(lang, "Barchasini ko'rish", "Показать все");
const MORE_IN_PANEL = (rest: number, lang?: BotLang) => L(lang, `… va yana ${rest} ta — admin panelda.`, `… и ещё ${rest} — в админ-панели.`);

/** /stat — statistika (msgId berilsa o'sha xabar tahrirlanadi) */
export async function sendAdminStats(chatId: string, period: StatPeriod = "today", msgId: number | null = null, lang?: BotLang): Promise<void> {
  const [s, prev, series] = await Promise.all([collectAdminStats(period), collectAdminStats(period, prevRange(period)), collectDailySeries(period === "30d" ? 30 : 7)]);
  const text = renderStats(s, undefined, { prev, series }, lang);
  if (msgId) {
    const r = await telegramApi("editMessageText", { chat_id: chatId, message_id: msgId, text, parse_mode: "HTML", reply_markup: { inline_keyboard: toInline(statsKeyboard(period, lang)) } });
    // Faol davr qayta bosilsa matn o'zgarmaydi — Telegram «message is not modified» deydi: bu xato emas (ilgari statistika
    // ikkinchi marta yangi xabar bo'lib yuborilardi)
    if (r?.ok || /not modified/i.test(r?.description ?? "")) return;
  }
  await sendTelegram(chatId, text, { keyboard: statsKeyboard(period, lang) });
}

function toInline(rows: TelegramButton[][]) {
  return rows.map((row) => row.map((b) => (b.webApp ? { text: b.text, web_app: { url: b.webApp } } : b.url ? { text: b.text, url: b.url } : { text: b.text, callback_data: b.data ?? "noop" })));
}

/* ------------------------------------------------------------------ */
/* Menyu, navbat, to'lovlar                                            */
/* ------------------------------------------------------------------ */
export async function sendAdminMenu(chatId: string, lang?: BotLang): Promise<void> {
  const q = await collectQueueCounts();
  const total = q.pendingSpecialists + q.manualPayments + q.manualInvoices + q.reports + q.disputes + q.payouts + q.mentorPayouts + q.mentorApps;
  const cnt = (v: number) => (v ? ` (${v})` : "");
  await sendTelegram(
    chatId,
    L(
      lang,
      `🛠 <b>Admin menyu</b>\n${total > 0 ? `📥 Navbatda <b>${total}</b> ta ish bor.` : "📥 Navbat bo'sh ✅"}\n\n/stat — statistika va trend · /navbat — tasdiq navbati · /tolovlar — o'tkazmalar · /shikoyatlar — shikoyatlar · /mentorlar — mentor arizalari · /nizolar — nizolar · /payoutlar — pul chiqarish · /user ism — foydalanuvchi · /narx — kontakt narxlari · /konkurs — ijod konkursi · /elon — ommaviy e'lon · /tuzoq — tuzoq va bloklangan IP'lar (/blok, /blokdan)`,
      `🛠 <b>Админ-меню</b>\n${total > 0 ? `📥 В очереди <b>${total}</b> задач.` : "📥 Очередь пуста ✅"}\n\n/stat — статистика и тренд · /navbat — очередь подтверждений · /tolovlar — переводы · /shikoyatlar — жалобы · /mentorlar — заявки менторов · /nizolar — споры · /payoutlar — вывод средств · /user имя — пользователь · /narx — цены контактов · /konkurs — творческий конкурс · /elon — рассылка · /tuzoq — ловушка и заблокированные IP (/blok, /blokdan)`,
    ),
    {
      keyboard: [
        [{ text: L(lang, "📊 Statistika", "📊 Статистика"), data: "adm:stat:today" }, { text: `${L(lang, "📥 Navbat", "📥 Очередь")}${cnt(total)}`, data: "adm:queue" }],
        [{ text: `${L(lang, "💳 To'lovlar", "💳 Платежи")}${cnt(q.manualPayments + q.manualInvoices)}`, data: "adm:pay" }, { text: `${L(lang, "🚩 Shikoyatlar", "🚩 Жалобы")}${cnt(q.reports)}`, data: "adm:reports" }],
        [{ text: `${L(lang, "🎓 Mentor arizalari", "🎓 Заявки менторов")}${cnt(q.mentorApps)}`, data: "adm:mentors" }, { text: `${L(lang, "💸 Payoutlar", "💸 Выплаты")}${cnt(q.payouts)}`, data: "adm:payouts" }],
        [{ text: `${L(lang, "⚖️ Nizolar", "⚖️ Споры")}${cnt(q.disputes)}`, data: "adm:disputes" }, { text: L(lang, "📣 E'lon", "📣 Рассылка"), data: "adm:elon" }],
        [{ text: L(lang, "🪤 Tuzoq", "🪤 Ловушка"), data: "adm:trap" }],
        [panelButton("/admin", PANEL(lang))],
      ],
      // Doimiy menyuga «🛠 Admin» qatori qo'shiladi
    },
  );
  await telegramApi("sendMessage", { chat_id: chatId, text: L(lang, "Pastdagi menyuda «🛠 Admin» tugmasi bor 👇", "В меню внизу есть кнопка «🛠 Админ» 👇"), reply_markup: { keyboard: menuRows(true, lang).map((row) => row.map((b) => (typeof b === "string" ? { text: b } : "webApp" in b ? { text: b.text, web_app: { url: b.webApp } } : { text: b.text }))), resize_keyboard: true, is_persistent: true } });
}

/** /navbat — tasdiq kutayotganlar, tezkor amallar bilan */
export async function sendAdminQueues(chatId: string, lang?: BotLang): Promise<void> {
  const q = await collectQueueCounts();
  // Tasdiq so'rovi yuborganlar (verificationRequestedAt) birinchi, keyin eng yangilar
  const pendingSp = await db.query.specialists.findMany({ where: and(eq(specialists.isVerified, false), eq(specialists.isHidden, false)), orderBy: [sql`${specialists.verificationRequestedAt} is null`, desc(specialists.createdAt)], limit: 5, with: { user: { columns: { name: true, email: true } } } });
  const lines = [
    L(lang, "📥 <b>Tasdiq navbati</b>", "📥 <b>Очередь подтверждений</b>"),
    "",
    `🎨 ${L(lang, "Mutaxassislar tasdig'i", "Подтверждение специалистов")}: <b>${q.pendingSpecialists}</b>${q.verifyRequests ? ` (${L(lang, "so'rov yuborgan", "запросили галочку")}: ${q.verifyRequests})` : ""}`,
    `💳 ${L(lang, "Qo'lda o'tkazmalar", "Ручные переводы")}: <b>${q.manualPayments + q.manualInvoices}</b> (${L(lang, "buyurtma", "заказы")} ${q.manualPayments}, ${L(lang, "obuna/kontakt/kurs", "подписка/контакт/курс")} ${q.manualInvoices})`,
    `🚩 ${L(lang, "Ochiq shikoyatlar", "Открытые жалобы")}: <b>${q.reports}</b>`,
    `⚖️ ${L(lang, "Ochiq nizolar", "Открытые споры")}: <b>${q.disputes}</b>`,
    `💸 ${L(lang, "Payout so'rovlari", "Запросы на выплату")}: <b>${q.payouts}</b> · ${L(lang, "mentor yechish", "вывод менторов")}: <b>${q.mentorPayouts}</b>`,
    `🎓 ${L(lang, "Mentor arizalari", "Заявки менторов")}: <b>${q.mentorApps}</b>`,
  ];
  const { getSettings } = await import("@/lib/payments/settings");
  const autoOn = (await getSettings()).autoVerifySpecialists === 1;
  lines.push("", autoOn ? L(lang, "🤖 Avtomatik tasdiqlash: <b>yoqilgan</b>", "🤖 Автоподтверждение: <b>включено</b>") : L(lang, "🤖 Avtomatik tasdiqlash: o'chiq", "🤖 Автоподтверждение: выключено"));
  const keyboard: TelegramButton[][] = [];
  keyboard.push([{ text: autoOn ? L(lang, "🤖 Avto-tasdiqni o'chirish", "🤖 Выключить автоподтверждение") : L(lang, "🤖 Avto-tasdiqni yoqish", "🤖 Включить автоподтверждение"), data: `adm:auto:${autoOn ? 0 : 1}` }]);
  if (q.manualPayments + q.manualInvoices > 0) keyboard.push([{ text: `${L(lang, "💳 O'tkazmalarni ko'rish", "💳 Показать переводы")} (${q.manualPayments + q.manualInvoices})`, data: "adm:pay" }]);
  if (q.reports > 0) keyboard.push([{ text: `${L(lang, "🚩 Shikoyatlarni ko'rish", "🚩 Показать жалобы")} (${q.reports})`, data: "adm:reports" }]);
  if (q.disputes > 0) keyboard.push([{ text: `${L(lang, "⚖️ Nizolar", "⚖️ Споры")} (${q.disputes})`, data: "adm:disputes" }]);
  if (q.payouts > 0) keyboard.push([{ text: `${L(lang, "💸 Payout so'rovlari", "💸 Запросы на выплату")} (${q.payouts})`, data: "adm:payouts" }]);
  if (q.mentorApps > 0) keyboard.push([{ text: `${L(lang, "🎓 Mentor arizalari", "🎓 Заявки менторов")} (${q.mentorApps})`, data: "adm:mentors" }]);
  if (q.mentorPayouts > 0) keyboard.push([panelButton("/admin/mentorlik", `${L(lang, "💸 Mentor yechish so'rovlari", "💸 Запросы менторов на вывод")} (${q.mentorPayouts})`)]);
  keyboard.push([panelButton("/admin", PANEL(lang))]);
  await sendTelegram(chatId, lines.join("\n"), { keyboard });
  // Mutaxassislar — har biri alohida xabar, «Tasdiqlash» tugmasi bilan
  for (const sp of pendingSp) {
    await sendTelegram(chatId, `🎨 <b>${escapeTelegramHtml(sp.user.name)}</b> — ${escapeTelegramHtml(sp.title)}\n${escapeTelegramHtml(sp.user.email)} · ${fmtDate(sp.createdAt.getTime())}`, {
      keyboard: [
        [
          { text: L(lang, "✅ Tasdiqlash", "✅ Подтвердить"), data: `adm:ver:${sp.id}` },
          { text: L(lang, "👁 Profil", "👁 Профиль"), url: `${site()}/mutaxassislar/${sp.slug}` },
        ],
      ],
    });
  }
  if (q.pendingSpecialists > pendingSp.length) await sendTelegram(chatId, MORE_IN_PANEL(q.pendingSpecialists - pendingSp.length, lang), { keyboard: [[panelButton("/admin#tasdiqlash", SEE_ALL(lang))]] });
}

/** /tolovlar — kutilayotgan qo'lda o'tkazmalar, tasdiqlash/rad etish tugmalari (mp: — webhook'dagi mavjud oqim) */
export async function sendAdminPayments(chatId: string, lang?: BotLang): Promise<void> {
  const [pay, inv] = await Promise.all([
    db.query.payments.findMany({ where: and(eq(payments.state, "pending"), eq(payments.provider, "manual")), orderBy: [desc(payments.createdAt)], limit: 8, with: { order: { columns: { title: true } }, client: { columns: { name: true } } } }),
    db.query.subscriptionInvoices.findMany({ where: and(eq(subscriptionInvoices.state, "pending"), eq(subscriptionInvoices.provider, "manual")), orderBy: [desc(subscriptionInvoices.createdAt)], limit: 8 }),
  ]);
  if (!pay.length && !inv.length) {
    await sendTelegram(chatId, L(lang, "💳 Kutilayotgan qo'lda o'tkazma yo'q ✅", "💳 Ожидающих ручных переводов нет ✅"));
    return;
  }
  const userIds = inv.map((i) => i.userId).filter((x): x is string => Boolean(x));
  const buyers = userIds.length ? await db.query.users.findMany({ where: inArray(users.id, userIds), columns: { id: true, name: true } }) : [];
  const bmap = new Map(buyers.map((b) => [b.id, b.name]));
  await sendTelegram(chatId, L(lang, `💳 <b>Kutilayotgan o'tkazmalar:</b> ${pay.length + inv.length} ta. Har birini tekshirib tasdiqlang yoki rad eting.`, `💳 <b>Ожидающие переводы:</b> ${pay.length + inv.length}. Проверьте каждый и подтвердите или отклоните.`));
  const OK = L(lang, "✅ Tasdiqlash", "✅ Подтвердить");
  const NO = L(lang, "❌ Rad etish", "❌ Отклонить");
  for (const p of pay) {
    await sendTelegram(chatId, `📦 <b>${L(lang, "Buyurtma to'lovi", "Оплата заказа")}</b> — ${formatPrice(p.amount)}\n«${escapeTelegramHtml(p.order?.title ?? L(lang, "Buyurtma", "Заказ"))}» · ${escapeTelegramHtml(p.client?.name ?? L(lang, "Mijoz", "Клиент"))} · ${fmtDate(p.createdAt.getTime())}`, {
      keyboard: [[{ text: OK, data: `mp:ok:p:${p.id}` }, { text: NO, data: `mp:no:p:${p.id}` }]],
    });
  }
  for (const i of inv) {
    const kind = (i.meta as { kind?: string } | null)?.kind;
    const title = isContactUnlock(i) ? contactMeta(i).title : kind === "purchase" ? purchaseMeta(i).title : L(lang, `${i.months} oylik obuna`, `Подписка на ${i.months} мес.`);
    const icon = isContactUnlock(i) ? "🔓" : kind === "purchase" ? "🎓" : "💠";
    const receipt = (i.meta as { receiptUrl?: string } | null)?.receiptUrl;
    const keyboard: TelegramButton[][] = [[{ text: OK, data: `mp:ok:s:${i.id}` }, { text: NO, data: `mp:no:s:${i.id}` }]];
    // Chek manzili diskda saqlanganda nisbiy (`/uploads/…`) bo'ladi — sayt manzili bilan to'ldiriladi (ilgari «chek bor» deb
    // yozilib, tugma chiqmasdi). Telegram tugmasi faqat https havolani qabul qiladi.
    const receiptUrl = receipt ? (receipt.startsWith("/") && !receipt.startsWith("//") ? `${site()}${receipt}` : receipt) : "";
    if (/^https:\/\//.test(receiptUrl)) keyboard.push([{ text: L(lang, "🧾 Chek", "🧾 Чек"), url: receiptUrl }]);
    await sendTelegram(chatId, `${icon} <b>${escapeTelegramHtml(title)}</b> — ${formatPrice(i.amount)}\n${escapeTelegramHtml(i.userId ? (bmap.get(i.userId) ?? L(lang, "Foydalanuvchi", "Пользователь")) : "—")} · ${fmtDate(i.createdAt.getTime())}${receipt ? L(lang, " · chek bor", " · есть чек") : ""}`, { keyboard });
  }
}

/* ------------------------------------------------------------------ */
/* Shikoyatlar va mentor arizalari — chatning o'zida hal qilinadi      */
/* ------------------------------------------------------------------ */
const REPORT_TYPE: Record<AdminReportRow["targetType"], string> = { specialist: "Profil", review: "Sharh", user: "Foydalanuvchi (chat)", post: "Post", comment: "Izoh", message: "Xabar" };
const REPORT_TYPE_RU: Record<AdminReportRow["targetType"], string> = { specialist: "профиль", review: "отзыв", user: "пользователя (чат)", post: "пост", comment: "комментарий", message: "сообщение" };
/** «Post shikoyati» / «Жалоба на пост» */
const reportTitle = (t: AdminReportRow["targetType"], lang?: BotLang) => L(lang, `${REPORT_TYPE[t]} shikoyati`, `Жалоба на ${REPORT_TYPE_RU[t]}`);
const targetExists = (r: AdminReportRow) => Boolean(r.target && !r.target.label.startsWith("O'chirilgan"));

function reportText(r: AdminReportRow, lang?: BotLang): string {
  const lines = [`🚩 <b>${reportTitle(r.targetType, lang)}</b> · ${fmtDate(r.createdAt)}`, `${L(lang, "Sabab", "Причина")}: ${escapeTelegramHtml(r.reason)}`];
  if (r.target) lines.push(`${L(lang, "Nishon", "Объект")}: <b>${escapeTelegramHtml(r.target.label)}</b>${r.target.snippet ? ` — <i>${escapeTelegramHtml(r.target.snippet.slice(0, 140))}</i>` : ""}`);
  if (r.owner?.isBanned) lines.push(L(lang, "Muallif allaqachon bloklangan 🚫", "Автор уже заблокирован 🚫"));
  lines.push(`${L(lang, "Shikoyatchi", "Пожаловался")}: ${escapeTelegramHtml(r.reporter.name)}`);
  return lines.join("\n");
}

function reportKeyboard(r: AdminReportRow, lang?: BotLang): TelegramButton[][] {
  const first: TelegramButton[] = [{ text: L(lang, "✅ Yopish", "✅ Закрыть"), data: `adm:rep:close:${r.id}` }];
  // Post/izoh/sharh — kontentni o'chirib, shikoyatni yopish (xabar va profil — faqat yopish/bloklash)
  if ((r.targetType === "post" || r.targetType === "comment" || r.targetType === "review") && targetExists(r)) first.push({ text: L(lang, "🗑 O'chirish + yopish", "🗑 Удалить + закрыть"), data: `adm:rep:del:${r.id}` });
  const rows: TelegramButton[][] = [first];
  const second: TelegramButton[] = [];
  if (r.owner && !r.owner.isBanned) second.push({ text: L(lang, "🚫 Muallifni bloklash", "🚫 Заблокировать автора"), data: `adm:ban:${r.owner.userId}` });
  if (r.target?.href) second.push({ text: L(lang, "👁 Ko'rish", "👁 Открыть"), url: `${site()}${r.target.href}` });
  if (second.length) rows.push(second);
  return rows;
}

/** /shikoyatlar — ochiq shikoyatlar, har biri alohida xabar: yopish / o'chirish / bloklash */
export async function sendAdminReports(chatId: string, lang?: BotLang): Promise<void> {
  const [rows, total] = await Promise.all([listAdminReports("open", 5), db.select({ c: sql<number>`count(*)` }).from(reports).where(eq(reports.status, "open")).then((r) => n(r[0]?.c))]);
  if (!rows.length) {
    await sendTelegram(chatId, L(lang, "🚩 Ochiq shikoyat yo'q ✅", "🚩 Открытых жалоб нет ✅"));
    return;
  }
  await sendTelegram(chatId, L(lang, `🚩 <b>Ochiq shikoyatlar:</b> ${total} ta. Har birini ko'rib chiqing — yoping, kontentni o'chiring yoki muallifni bloklang.`, `🚩 <b>Открытые жалобы:</b> ${total}. Рассмотрите каждую — закройте, удалите контент или заблокируйте автора.`));
  for (const r of rows) await sendTelegram(chatId, reportText(r, lang), { keyboard: reportKeyboard(r, lang) });
  if (total > rows.length) await sendTelegram(chatId, MORE_IN_PANEL(total - rows.length, lang), { keyboard: [[panelButton("/admin#shikoyatlar", SEE_ALL(lang))]] });
}

/** /mentorlar — tasdiq kutayotgan mentor arizalari: tasdiqlash / rad etish */
export async function sendAdminMentorApps(chatId: string, lang?: BotLang): Promise<void> {
  const all = await listPendingMentors();
  if (!all.length) {
    await sendTelegram(chatId, L(lang, "🎓 Kutilayotgan mentor arizasi yo'q ✅", "🎓 Ожидающих заявок менторов нет ✅"));
    return;
  }
  const rows = all.slice(0, 5);
  await sendTelegram(chatId, L(lang, `🎓 <b>Mentor arizalari:</b> ${all.length} ta. Tasdiqlangan mentor kurs ochadi va dars beradi.`, `🎓 <b>Заявки менторов:</b> ${all.length}. Подтверждённый ментор открывает курсы и ведёт уроки.`));
  for (const m of rows) {
    const text = [
      `🎓 <b>${escapeTelegramHtml(m.user.name)}</b> — ${escapeTelegramHtml(m.headline)}`,
      m.bio ? `<i>${escapeTelegramHtml(m.bio.slice(0, 220))}${m.bio.length > 220 ? "…" : ""}</i>` : "",
      `${escapeTelegramHtml(m.user.email)}${m.appliedAt ? ` · ${fmtDate(m.appliedAt)}` : ""}`,
    ].filter(Boolean);
    await sendTelegram(chatId, text.join("\n"), { keyboard: [[{ text: L(lang, "✅ Tasdiqlash", "✅ Подтвердить"), data: `adm:ma:ok:${m.id}` }, { text: L(lang, "❌ Rad etish", "❌ Отклонить"), data: `adm:ma:no:${m.id}` }], [panelButton("/admin/mentorlik", L(lang, "👁 Admin panelda", "👁 В админ-панели"))]] });
  }
  if (all.length > rows.length) await sendTelegram(chatId, MORE_IN_PANEL(all.length - rows.length, lang), { keyboard: [[panelButton("/admin/mentorlik", SEE_ALL(lang))]] });
}

/** /nizolar — ochiq nizolar ro'yxati; QAROR (pulni chiqarish/qaytarish) faqat admin panelda */
export async function sendAdminDisputes(chatId: string, lang?: BotLang): Promise<void> {
  const rows = await listOpenDisputes(5);
  if (!rows.length) {
    await sendTelegram(chatId, L(lang, "⚖️ Ochiq nizo yo'q ✅", "⚖️ Открытых споров нет ✅"));
    return;
  }
  const total = await db.select({ c: sql<number>`count(*)` }).from(orders).where(eq(orders.disputeState, "open")).then((r) => n(r[0]?.c));
  await sendTelegram(chatId, L(lang, `⚖️ <b>Ochiq nizolar:</b> ${total} ta. Qaror (pulni mutaxassisga chiqarish yoki mijozga qaytarish) faqat admin panelda — chat va dalillar o'sha yerda.`, `⚖️ <b>Открытые споры:</b> ${total}. Решение (выплата специалисту или возврат клиенту) — только в админ-панели, там же чат и доказательства.`));
  for (const o of rows) {
    const by = o.disputeOpenedBy === o.clientId ? `${L(lang, "mijoz", "клиент")} (${o.client.name})` : o.disputeOpenedBy === o.specialist.userId ? `${L(lang, "mutaxassis", "специалист")} (${o.specialist.user.name})` : L(lang, "tomon", "сторона");
    const age = Math.max(0, Math.floor((Date.now() - o.updatedAt.getTime()) / DAY));
    const text = [
      `⚖️ <b>${escapeTelegramHtml(o.title)}</b> — ${formatPrice(o.amount ?? 0)}`,
      `${escapeTelegramHtml(o.client.name)} ↔ ${escapeTelegramHtml(o.specialist.user.name)} · ${L(lang, "ochdi", "открыл")}: ${escapeTelegramHtml(by)} · ${age} ${L(lang, "kun", "дн.")}`,
      o.disputeReason ? `${L(lang, "Sabab", "Причина")}: <i>${escapeTelegramHtml(o.disputeReason.slice(0, 200))}</i>` : "",
    ].filter(Boolean);
    await sendTelegram(chatId, text.join("\n"), { keyboard: [[panelButton("/admin#nizolar", L(lang, "⚖️ Hal qilish (panel)", "⚖️ Решить (панель)")), { text: L(lang, "📦 Buyurtma", "📦 Заказ"), url: `${site()}/buyurtma/${o.id}` }]] });
  }
  if (total > rows.length) await sendTelegram(chatId, MORE_IN_PANEL(total - rows.length, lang), { keyboard: [[panelButton("/admin#nizolar", SEE_ALL(lang))]] });
}

/** Payout holati yorlig'i (uz — constants, ru — shu yerda) */
const PAYOUT_STATE_RU: Record<string, string> = { requested: "запрошено", approved: "одобрено", paid: "выплачено", rejected: "отклонено" };
const payoutState = (state: string, lang?: BotLang) => (lang === "ru" ? (PAYOUT_STATE_RU[state] ?? state) : ((PAYOUT_STATE_LABEL as Record<string, string>)[state] ?? state));

/** /payoutlar — pul chiqarish so'rovlari: «To'landi» (kartaga o'tkazgach) / «Rad etish» (summa balansga qaytadi); rekvizit faqat panelda */
export async function sendAdminPayouts(chatId: string, lang?: BotLang): Promise<void> {
  const all = (await listAdminPayouts(40)).filter((p) => p.state === "requested" || p.state === "approved");
  const rows = all.slice(0, 5);
  if (!rows.length) {
    await sendTelegram(chatId, L(lang, "💸 Kutilayotgan pul chiqarish so'rovi yo'q ✅", "💸 Ожидающих запросов на вывод нет ✅"));
    return;
  }
  // Sarlavhada JAMI son (ilgari faqat ko'rsatilgan 5 tasi sanalardi)
  await sendTelegram(chatId, L(lang, `💸 <b>Pul chiqarish so'rovlari:</b> ${all.length} ta. Rekvizitni admin panelda ko'rib, kartaga o'tkazing — so'ng «To'landi» bosing.`, `💸 <b>Запросы на вывод:</b> ${all.length}. Посмотрите реквизиты в админ-панели, переведите на карту — затем нажмите «Выплачено».`));
  for (const p of rows) {
    // Karta raqami niqoblanadi (faqat birinchi 4 va oxirgi 4 raqam) — to'liq rekvizit faqat admin panelda
    const digits = p.details.replace(/\D/g, "");
    const masked = digits.length >= 12 ? `${digits.slice(0, 4)} •••• •••• ${digits.slice(-4)}` : p.details.replace(/\d(?=\d{3})/g, "•");
    const text = [
      `💸 <b>${escapeTelegramHtml(p.specialist.user.name)}</b> — ${formatPrice(p.amount)} (${payoutState(p.state, lang)})`,
      `${escapeTelegramHtml(p.method)} · ${escapeTelegramHtml(masked)} · ${fmtDate(p.createdAt.getTime())}`,
      `${L(lang, "Balans qoplaydi", "Баланс покрывает")}: ${p.releasedBalance >= p.amount ? L(lang, "ha ✅", "да ✅") : `${L(lang, "yo'q ❌ (mavjud", "нет ❌ (доступно")} ${formatPrice(Math.max(0, p.releasedBalance))})`}`,
    ];
    await sendTelegram(chatId, text.join("\n"), {
      keyboard: [
        [{ text: L(lang, "✅ To'landi", "✅ Выплачено"), data: `adm:po:paid:${p.id}` }, { text: L(lang, "❌ Rad etish", "❌ Отклонить"), data: `adm:po:rej:${p.id}` }],
        [panelButton("/admin#payoutlar", L(lang, "👁 Rekvizit (panel)", "👁 Реквизиты (панель)"))],
      ],
    });
  }
  if (all.length > rows.length) await sendTelegram(chatId, MORE_IN_PANEL(all.length - rows.length, lang), { keyboard: [[panelButton("/admin#payoutlar", SEE_ALL(lang))]] });
}

/** Payout qarori botdan — admin panel route'i bilan bir xil CAS/balans tekshiruvi; rad etish sababi standart */
async function decidePayout(payoutId: string, admin: { id: string; name: string }, state: "paid" | "rejected", lang?: BotLang): Promise<string> {
  const payout = await db.query.payouts.findFirst({ where: eq(payouts.id, payoutId) });
  if (!payout) throw new ApiError(404, L(lang, "So'rov topilmadi", "Запрос не найден"));
  if (payout.state !== "requested" && payout.state !== "approved") return L(lang, `Allaqachon «${PAYOUT_STATE_LABEL[payout.state]}»`, `Уже «${payoutState(payout.state, lang)}»`);
  if (state === "paid") {
    const b = await getSpecialistBalance(payout.specialistId);
    const cover = b.released - b.paidOut - (b.pendingPayouts - payout.amount);
    if (cover < payout.amount) throw new ApiError(400, L(lang, `Balans yetarli emas (mavjud ${formatPrice(Math.max(0, cover))})`, `Недостаточно средств на балансе (доступно ${formatPrice(Math.max(0, cover))})`));
  }
  const note = state === "rejected" ? "Administrator tomonidan rad etildi (Telegram)" : payout.note;
  const [row] = await db
    .update(payouts)
    .set({ state, note, processedBy: admin.id, processedAt: new Date() })
    .where(and(eq(payouts.id, payoutId), eq(payouts.state, payout.state)))
    .returning({ id: payouts.id });
  if (!row) throw new ApiError(409, L(lang, "Holat parallel o'zgargan — panelda tekshiring", "Статус изменился параллельно — проверьте в панели"));
  await audit(admin.id, "admin_payout", { targetType: "payout", targetId: payoutId, meta: { from: payout.state, to: state, amount: payout.amount, via: "telegram" } });
  const ownerId = await specialistOwnerId(payout.specialistId);
  if (ownerId) {
    await notify(
      ownerId,
      "payout",
      state === "paid" ? `Pul o'tkazildi: ${formatPrice(payout.amount)}` : `Pul chiqarish rad etildi: ${formatPrice(payout.amount)}`,
      state === "paid" ? `${payout.details} rekvizitiga o'tkazildi.` : `Sabab: ${note}. Summa balansingizga qaytdi.`,
      "/kabinet/tolovlar",
    ).catch(() => undefined);
  }
  return state === "paid" ? L(lang, "To'landi deb belgilandi ✅", "Отмечено как выплачено ✅") : L(lang, "Rad etildi, summa balansga qaytdi", "Отклонено, сумма вернулась на баланс");
}

/** Shikoyat nishonini o'chirish (post/izoh/sharh) — admin panel bilan bir xil mantiq */
async function deleteReportTarget(r: { targetType: AdminReportRow["targetType"]; targetId: string }, adminId: string, lang?: BotLang): Promise<string> {
  if (r.targetType === "post") {
    const post = await db.query.posts.findFirst({ where: eq(posts.id, r.targetId) });
    if (!post) return L(lang, "Post allaqachon o'chirilgan", "Пост уже удалён");
    await deletePost(post);
    await audit(adminId, "post_delete", { targetType: "post", targetId: post.id, meta: { authorId: post.authorId, via: "telegram" } });
    return L(lang, "Post o'chirildi 🗑", "Пост удалён 🗑");
  }
  if (r.targetType === "comment") {
    const c = await db.query.postComments.findFirst({ where: eq(postComments.id, r.targetId) });
    const post = c ? await db.query.posts.findFirst({ where: eq(posts.id, c.postId) }) : null;
    if (!c || !post) return L(lang, "Izoh allaqachon o'chirilgan", "Комментарий уже удалён");
    await deleteComment(c, post);
    await audit(adminId, "comment_delete", { targetType: "comment", targetId: c.id, meta: { authorId: c.authorId, via: "telegram" } });
    return L(lang, "Izoh o'chirildi 🗑", "Комментарий удалён 🗑");
  }
  if (r.targetType === "review") {
    const row = await db.query.reviews.findFirst({ where: eq(reviews.id, r.targetId), columns: { id: true, specialistId: true, authorId: true, rating: true } });
    if (!row) return L(lang, "Sharh allaqachon o'chirilgan", "Отзыв уже удалён");
    await db.delete(reviews).where(eq(reviews.id, row.id));
    await recalcRating(row.specialistId);
    await audit(adminId, "review_deleted", { targetType: "review", targetId: row.id, meta: { admin: true, specialistId: row.specialistId, authorId: row.authorId, rating: row.rating, via: "telegram" } });
    return L(lang, "Sharh o'chirildi, reyting qayta hisoblandi 🗑", "Отзыв удалён, рейтинг пересчитан 🗑");
  }
  throw new ApiError(400, L(lang, "Bu turdagi nishon botdan o'chirilmaydi — admin panelda ko'ring", "Объект этого типа из бота не удаляется — откройте админ-панель"));
}

/* ------------------------------------------------------------------ */
/* Foydalanuvchi qidirish va bloklash                                  */
/* ------------------------------------------------------------------ */
const ROLE: Record<string, string> = { client: "Mijoz", specialist: "Mutaxassis", admin: "Admin" };
const ROLE_RU: Record<string, string> = { client: "Клиент", specialist: "Специалист", admin: "Админ" };

export async function handleAdminUserSearch(chatId: string, q: string, lang?: BotLang): Promise<void> {
  const needle = q.trim().replace(/^@/, "");
  if (needle.length < 2) {
    await sendTelegram(chatId, L(lang, "Qidirish: <code>/user ism</code>, <code>/user email</code>, <code>/user @taxallus</code> yoki <code>/user telefon</code>", "Поиск: <code>/user имя</code>, <code>/user email</code>, <code>/user @ник</code> или <code>/user телефон</code>"));
    return;
  }
  // Ism/email/taxallus: registrning bir nechta varianti bilan (SQLite `lower()` kirillchani kichraytirmaydi — «Алишер» topilmasdi).
  // Telefon: ustun shifrlangan, `LIKE` ishlamaydi — raqamlar ochib solishtiriladi (aniq / oxirgi raqamlar bo'yicha).
  const phoneIds = await userIdsByPhone(needle).catch(() => [] as string[]);
  const rows = await db.query.users.findMany({
    where: or(likeAny(users.name, needle), likeAny(users.email, needle), likeAny(sql`coalesce(${users.username}, '')`, needle), ...(phoneIds.length ? [inArray(users.id, phoneIds)] : [])),
    orderBy: [desc(users.createdAt)],
    limit: 5,
    columns: { id: true, name: true, email: true, role: true, isBanned: true, bannedReason: true, username: true, createdAt: true, telegramChatId: true, lastSeenAt: true },
    with: { specialist: { columns: { slug: true, isVerified: true, isHidden: true } } },
  });
  if (!rows.length) {
    await sendTelegram(chatId, L(lang, `«${escapeTelegramHtml(q.trim())}» bo'yicha hech kim topilmadi.`, `По запросу «${escapeTelegramHtml(q.trim())}» никого не найдено.`));
    return;
  }
  for (const u of rows) {
    const lines = [
      `👤 <b>${escapeTelegramHtml(u.name)}</b> — ${(lang === "ru" ? ROLE_RU : ROLE)[u.role] ?? u.role}${u.isBanned ? L(lang, " · 🚫 BLOKLANGAN", " · 🚫 ЗАБЛОКИРОВАН") : ""}`,
      `${escapeTelegramHtml(u.email)}${u.username ? ` · @${escapeTelegramHtml(u.username)}` : ""}`,
      `${L(lang, "Ro'yxatdan", "Регистрация")}: ${fmtDate(u.createdAt.getTime())}${u.lastSeenAt ? ` · ${L(lang, "so'nggi faollik", "последняя активность")} ${fmtDate(u.lastSeenAt.getTime())}` : ""} · Telegram ${u.telegramChatId ? L(lang, "ulangan", "подключён") : L(lang, "yo'q", "нет")}`,
      u.specialist ? `${L(lang, "Profil", "Профиль")}: ${u.specialist.isHidden ? L(lang, "yashirin", "скрыт") : u.specialist.isVerified ? L(lang, "tasdiqlangan ✅", "подтверждён ✅") : L(lang, "tasdiq kutmoqda", "ждёт подтверждения")}` : "",
      u.isBanned && u.bannedReason ? `${L(lang, "Sabab", "Причина")}: ${escapeTelegramHtml(u.bannedReason)}` : "",
    ].filter(Boolean);
    const keyboard: TelegramButton[][] = [];
    if (u.role !== "admin") keyboard.push([u.isBanned ? { text: L(lang, "✅ Blokdan chiqarish", "✅ Разблокировать"), data: `adm:unban:${u.id}` } : { text: L(lang, "🚫 Bloklash", "🚫 Заблокировать"), data: `adm:ban:${u.id}` }]);
    // Kontakt sotuvi: rejim va maxsus narx — mutaxassis profili bo'lsa
    if (u.specialist?.slug) keyboard.push([{ text: L(lang, "🔓 Sotilsin", "🔓 Продавать"), data: `adm:cm:${u.id}:paid` }, { text: L(lang, "🔒 Faqat portfolio", "🔒 Только портфолио"), data: `adm:cm:${u.id}:hidden` }, { text: L(lang, "💰 Maxsus narx", "💰 Особая цена"), data: `adm:cp:${u.id}` }]);
    const row: TelegramButton[] = [panelButton(`/admin#foydalanuvchilar`, L(lang, "Admin panel", "Админ-панель"))];
    if (u.specialist?.slug) row.push({ text: L(lang, "Ommaviy profil", "Публичный профиль"), url: `${site()}/mutaxassislar/${u.specialist.slug}` });
    keyboard.push(row);
    await sendTelegram(chatId, lines.join("\n"), { keyboard });
  }
}

/* ------------------------------------------------------------------ */
/* Tugmalar: adm:*                                                     */
/* ------------------------------------------------------------------ */
export async function handleAdminCallback(chatId: string, data: string, answer: Answer, msgId: number | null, lang?: BotLang): Promise<boolean> {
  if (!data.startsWith("adm:")) return false;
  const admin = await adminByChat(chatId);
  if (!admin) {
    await answer(L(lang, "Faqat administrator uchun", "Только для администратора"));
    return true;
  }
  let m: RegExpExecArray | null;
  try {
    // Tuzoq holati va IP bloklash tugmalari (`adm:trap`, `adm:ipb|ipu:<ip>`) — lib/telegram-bot/admin-security.ts
    if (data === "adm:trap" || data.startsWith("adm:ip")) {
      const { handleAdminSecurityCallback } = await import("@/lib/telegram-bot/admin-security");
      if (await handleAdminSecurityCallback(chatId, admin, data, answer, lang)) return true;
    }
    if ((m = /^adm:stat:(today|7d|30d)$/.exec(data))) {
      await answer("");
      await sendAdminStats(chatId, m[1] as StatPeriod, msgId, lang);
      return true;
    }
    if (data === "adm:queue") {
      await answer("");
      await sendAdminQueues(chatId, lang);
      return true;
    }
    if (data === "adm:pay") {
      await answer("");
      await sendAdminPayments(chatId, lang);
      return true;
    }
    if (data === "adm:reports") {
      await answer("");
      await sendAdminReports(chatId, lang);
      return true;
    }
    if (data === "adm:mentors") {
      await answer("");
      await sendAdminMentorApps(chatId, lang);
      return true;
    }
    if ((m = /^adm:rep:(close|del):([\w-]{1,64})$/.exec(data))) {
      const r = await db.query.reports.findFirst({ where: eq(reports.id, m[2]), columns: { id: true, status: true, targetType: true, targetId: true } });
      if (!r) {
        await answer(L(lang, "Shikoyat topilmadi", "Жалоба не найдена"));
        return true;
      }
      // CAS: shikoyatni AVVAL yopamiz (faqat hali ochiq bo'lsa) — kontent shundan keyingina o'chiriladi. Ilgari o'chirish holat
      // tekshiruvidan oldin bajarilib, boshqa admin «yopish — kontent qolsin» deb hal qilgan shikoyat bo'yicha ham post o'chib ketardi
      const [won] = await db.update(reports).set({ status: "closed", resolvedBy: admin.id }).where(and(eq(reports.id, r.id), eq(reports.status, "open"))).returning({ id: reports.id });
      if (!won) {
        await answer(L(lang, "Bu shikoyat allaqachon yopilgan", "Эта жалоба уже закрыта"));
        if (msgId) await telegramApi("editMessageReplyMarkup", { chat_id: chatId, message_id: msgId, reply_markup: { inline_keyboard: [] } });
        return true;
      }
      let note = "";
      if (m[1] === "del") {
        note = await deleteReportTarget(r, admin.id, lang);
        // Bir xil nishon bo'yicha qolgan ochiq shikoyatlar ham yopiladi (kontent endi yo'q)
        await db
          .update(reports)
          .set({ status: "closed", resolvedBy: admin.id })
          .where(and(eq(reports.targetType, r.targetType), eq(reports.targetId, r.targetId), eq(reports.status, "open")));
      }
      await audit(admin.id, "admin_report_closed", { targetType: "report", targetId: r.id, meta: { target: `${r.targetType}:${r.targetId}`, via: "telegram", deleted: m[1] === "del" } });
      // O'chirmasdan yopish = avto-yashirilgan post/izoh/sharhni qaytarish (lib/moderation.ts)
      if (m[1] === "close") {
        const { restoreIfNoOpenReports } = await import("@/lib/moderation");
        if (await restoreIfNoOpenReports(r.targetType, r.targetId).catch(() => false)) note = L(lang, "Yopildi, kontent qaytarildi ✅", "Закрыто, контент возвращён ✅");
      }
      await answer(note || L(lang, "Yopildi ✅", "Закрыто ✅"));
      if (msgId) await telegramApi("editMessageText", { chat_id: chatId, message_id: msgId, text: `✅ <b>${L(lang, `${REPORT_TYPE[r.targetType]} shikoyati yopildi`, `${reportTitle(r.targetType, lang)} закрыта`)}</b>${note ? ` · ${escapeTelegramHtml(note)}` : ""} · ${escapeTelegramHtml(admin.name)}`, parse_mode: "HTML" });
      return true;
    }
    if ((m = /^adm:ma:(ok|no):([\w-]{1,64})$/.exec(data))) {
      const approve = m[1] === "ok";
      const mentor = await db.query.mentors.findFirst({ where: eq(mentors.id, m[2]), columns: { id: true, isApproved: true }, with: { user: { columns: { name: true } } } });
      if (!mentor) {
        await answer(L(lang, "Ariza topilmadi (rad etilgan bo'lishi mumkin)", "Заявка не найдена (возможно, отклонена)"));
        return true;
      }
      if (mentor.isApproved) {
        await answer(L(lang, "Allaqachon tasdiqlangan ✓", "Уже подтверждено ✓"));
        return true;
      }
      const { userId } = await setMentorApproved(mentor.id, approve);
      await audit(admin.id, approve ? "admin_mentor_approved" : "admin_mentor_rejected", { targetType: "mentor", targetId: mentor.id, meta: { userId, via: "telegram" } });
      await notify(
        userId,
        "account",
        approve ? "Siz mentor sifatida tasdiqlandingiz 🎓" : "Mentorlik arizangiz qabul qilinmadi",
        approve ? "Endi kurs ochib, dars berishingiz mumkin — Kabinet → Mentorlik." : "Batafsil ma'lumot uchun qo'llab-quvvatlashga yozing.",
        approve ? "/kabinet/mentorlik" : "/mentorlik",
      ).catch(() => undefined);
      await answer(approve ? L(lang, "Mentor tasdiqlandi 🎓", "Ментор подтверждён 🎓") : L(lang, "Ariza rad etildi", "Заявка отклонена"));
      if (msgId) await telegramApi("editMessageText", { chat_id: chatId, message_id: msgId, text: `${approve ? "✅" : "❌"} <b>${escapeTelegramHtml(mentor.user.name)}</b> — ${approve ? L(lang, "mentor sifatida tasdiqlandi", "подтверждён как ментор") : L(lang, "arizasi rad etildi", "заявка отклонена")} · ${escapeTelegramHtml(admin.name)}`, parse_mode: "HTML" });
      return true;
    }
    if (data === "adm:disputes") {
      await answer("");
      await sendAdminDisputes(chatId, lang);
      return true;
    }
    if (data === "adm:payouts") {
      await answer("");
      await sendAdminPayouts(chatId, lang);
      return true;
    }
    if ((m = /^adm:po:(paid|rej):([\w-]{1,64})$/.exec(data))) {
      const note = await decidePayout(m[2], admin, m[1] === "paid" ? "paid" : "rejected", lang);
      await answer(note);
      if (msgId) await telegramApi("editMessageText", { chat_id: chatId, message_id: msgId, text: `${m[1] === "paid" ? "✅" : "❌"} <b>${L(lang, "Payout", "Выплата")}:</b> ${escapeTelegramHtml(note)} · ${escapeTelegramHtml(admin.name)}`, parse_mode: "HTML" });
      return true;
    }
    if (data === "adm:menu") {
      await answer("");
      await sendAdminMenu(chatId, lang);
      return true;
    }
    if (data === "adm:elon") {
      await answer("");
      const { handleBroadcastStart } = await import("@/lib/telegram-bot/broadcast-flow");
      await handleBroadcastStart(chatId, "/elon", lang);
      return true;
    }
    if ((m = /^adm:auto:([01])$/.exec(data))) {
      const on = m[1] === "1";
      const { getSettings, saveSettings } = await import("@/lib/payments/settings");
      const before = (await getSettings()).autoVerifySpecialists;
      await saveSettings({ autoVerifySpecialists: on ? 1 : 0 });
      await audit(admin.id, "admin_settings", { targetType: "platform_settings", meta: { before: { autoVerifySpecialists: before }, after: { autoVerifySpecialists: on ? 1 : 0 }, via: "telegram" } });
      await answer(on ? L(lang, "Avtomatik tasdiqlash yoqildi", "Автоподтверждение включено") : L(lang, "Avtomatik tasdiqlash o'chirildi", "Автоподтверждение выключено"));
      if (msgId) await telegramApi("editMessageReplyMarkup", { chat_id: chatId, message_id: msgId, reply_markup: { inline_keyboard: [] } }).catch(() => undefined);
      await sendAdminQueues(chatId, lang);
      return true;
    }
    if ((m = /^adm:unver:([\w-]{1,64})$/.exec(data))) {
      const sp = await db.query.specialists.findFirst({ where: eq(specialists.id, m[1]), columns: { id: true, isVerified: true }, with: { user: { columns: { name: true } } } });
      if (!sp) {
        await answer(L(lang, "Profil topilmadi", "Профиль не найден"));
        return true;
      }
      if (sp.isVerified) {
        await db.update(specialists).set({ isVerified: false, updatedAt: new Date() }).where(eq(specialists.id, sp.id));
        await audit(admin.id, "admin_unverify", { targetType: "specialist", targetId: sp.id, meta: { via: "telegram" } });
      }
      await answer(L(lang, "Tasdiq bekor qilindi", "Подтверждение отменено"));
      if (msgId)
        await telegramApi("editMessageText", {
          chat_id: chatId,
          message_id: msgId,
          text: `↩️ <b>${escapeTelegramHtml(sp.user.name)}</b> — ${L(lang, "tasdiq bekor qilindi, navbatga qaytdi", "подтверждение отменено, снова в очереди")} · ${escapeTelegramHtml(admin.name)}`,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: [[{ text: L(lang, "✅ Tasdiqlash", "✅ Подтвердить"), callback_data: `adm:ver:${sp.id}` }]] },
        });
      return true;
    }
    if ((m = /^adm:ver:([\w-]{1,64})$/.exec(data))) {
      const sp = await db.query.specialists.findFirst({ where: eq(specialists.id, m[1]), columns: { id: true, userId: true, isVerified: true, slug: true }, with: { user: { columns: { name: true } } } });
      if (!sp) {
        await answer(L(lang, "Profil topilmadi", "Профиль не найден"));
        return true;
      }
      if (sp.isVerified) {
        await answer(L(lang, "Allaqachon tasdiqlangan ✓", "Уже подтверждено ✓"));
        return true;
      }
      await db.update(specialists).set({ isVerified: true, verificationRequestedAt: null, verificationNote: null, updatedAt: new Date() }).where(eq(specialists.id, sp.id));
      await audit(admin.id, "admin_verify", { targetType: "specialist", targetId: sp.id, meta: { via: "telegram" } });
      await notify(sp.userId, "account", "Profilingiz tasdiqlandi ✅", "Administrator profilingizni ko'rib chiqdi va tasdiqladi — endi katalogda «tasdiqlangan» belgisi bilan chiqasiz.", `/mutaxassislar/${sp.slug}`).catch(() => undefined);
      await answer(L(lang, "Tasdiqlandi ✅", "Подтверждено ✅"));
      if (msgId) await telegramApi("editMessageText", { chat_id: chatId, message_id: msgId, text: `✅ <b>${escapeTelegramHtml(sp.user.name)}</b> ${L(lang, "tasdiqlandi", "подтверждён")} · ${escapeTelegramHtml(admin.name)}`, parse_mode: "HTML" });
      return true;
    }
    if ((m = /^adm:cm:([\w-]{1,64}):(paid|hidden)$/.exec(data))) {
      const sp = await db.query.specialists.findFirst({ where: eq(specialists.userId, m[1]), columns: { id: true, contactMode: true } });
      if (!sp) {
        await answer(L(lang, "Mutaxassis profili yo'q", "Нет профиля специалиста"));
        return true;
      }
      const mode = m[2] as "paid" | "hidden";
      if (sp.contactMode !== mode) {
        await db.update(specialists).set({ contactMode: mode, updatedAt: new Date() }).where(eq(specialists.id, sp.id));
        await audit(admin.id, "admin_contact_settings", { targetType: "specialist", targetId: sp.id, meta: { contactMode: mode, via: "telegram" } });
      }
      await answer(mode === "paid" ? L(lang, "Kontakt sotiladi 🔓", "Контакт продаётся 🔓") : L(lang, "Faqat portfolio 🔒", "Только портфолио 🔒"));
      return true;
    }
    if ((m = /^adm:cp:([\w-]{1,64})$/.exec(data))) {
      const sp = await db.query.specialists.findFirst({ where: eq(specialists.userId, m[1]), columns: { id: true, contactPrice: true, experience: true }, with: { user: { columns: { name: true } } } });
      if (!sp) {
        await answer(L(lang, "Mutaxassis profili yo'q", "Нет профиля специалиста"));
        return true;
      }
      const { setBotSession } = await import("@/lib/telegram-bot/session");
      await setBotSession(chatId, "adminprice", "amount", { specialistId: sp.id, name: sp.user.name });
      await answer("");
      const cur = sp.contactPrice == null ? L(lang, "umumiy (daraja bo'yicha)", "общая (по уровню)") : formatPrice(sp.contactPrice);
      await sendTelegram(chatId, L(lang, `💰 <b>${escapeTelegramHtml(sp.user.name)}</b> uchun maxsus kontakt narxini yozing (so'm, masalan <code>75000</code>). Umumiy narxga qaytarish — <code>0</code> yoki <code>yoq</code>. Hozir: ${cur}.`, `💰 Напишите особую цену контакта для <b>${escapeTelegramHtml(sp.user.name)}</b> (сум, например <code>75000</code>). Вернуть общую цену — <code>0</code> или <code>yoq</code>. Сейчас: ${cur}.`));
      return true;
    }
    if ((m = /^adm:(ban|unban):([\w-]{1,64})$/.exec(data))) {
      const ban = m[1] === "ban";
      const u = await db.query.users.findFirst({ where: eq(users.id, m[2]), columns: { id: true, name: true, role: true, isBanned: true } });
      if (!u) {
        await answer(L(lang, "Foydalanuvchi topilmadi", "Пользователь не найден"));
        return true;
      }
      if (u.role === "admin" || u.id === admin.id) {
        await answer(L(lang, "Administratorni bloklab bo'lmaydi", "Администратора нельзя заблокировать"));
        return true;
      }
      if (u.isBanned === ban) {
        await answer(ban ? L(lang, "Allaqachon bloklangan", "Уже заблокирован") : L(lang, "Bloklanmagan", "Не заблокирован"));
        return true;
      }
      const why = ban ? "Administrator tomonidan Telegram orqali bloklandi" : null;
      await db.update(users).set({ isBanned: ban, bannedReason: why }).where(eq(users.id, u.id));
      if (ban) await bumpSessionVersion(u.id);
      await audit(admin.id, ban ? "admin_ban" : "admin_unban", { targetType: "user", targetId: u.id, meta: { reason: why ?? undefined, name: u.name, via: "telegram" } });
      await notify(u.id, "account", ban ? "Hisobingiz bloklandi" : "Hisobingiz blokdan chiqarildi", ban ? `Sabab: ${why}. Savollar bo'lsa qo'llab-quvvatlash bilan bog'laning.` : "Platformadan yana to'liq foydalanishingiz mumkin.", "/kabinet").catch(() => undefined);
      await answer(ban ? L(lang, "Bloklandi 🚫", "Заблокирован 🚫") : L(lang, "Blokdan chiqarildi ✅", "Разблокирован ✅"));
      if (msgId) {
        await telegramApi("editMessageReplyMarkup", { chat_id: chatId, message_id: msgId, reply_markup: { inline_keyboard: toInline([[ban ? { text: L(lang, "✅ Blokdan chiqarish", "✅ Разблокировать"), data: `adm:unban:${u.id}` } : { text: L(lang, "🚫 Bloklash", "🚫 Заблокировать"), data: `adm:ban:${u.id}` }]]) } });
      }
      return true;
    }
  } catch (e) {
    await answer(e instanceof ApiError ? e.message : L(lang, "Xatolik — admin panelda ko'rib chiqing", "Ошибка — проверьте в админ-панели"));
    return true;
  }
  await answer(L(lang, "Noma'lum amal", "Неизвестное действие"));
  return true;
}

/* ------------------------------------------------------------------ */
/* Kunlik hisobot (cron)                                               */
/* ------------------------------------------------------------------ */
/** Har admin Telegramiga kechagi kun hisoboti — bir kunda bir marta (rate_limits CAS) */
/** `opts.force` — kunlik dedupe'siz (admin panel «Kunlik hisobot» tugmasi), `opts.onlyChat` — faqat shu chatga */
export async function sendAdminDailyReport(now = Date.now(), opts: { force?: boolean; onlyChat?: string } = {}): Promise<{ sent: number; skipped: boolean }> {
  // Har admin o'z tilida (users.lang: ru → ruscha; null → uz)
  const all = await db.query.users.findMany({ where: and(eq(users.role, "admin"), isNotNull(users.telegramChatId), eq(users.isBanned, false)), columns: { id: true, telegramChatId: true, lang: true } });
  const admins = opts.onlyChat ? all.filter((a) => a.telegramChatId === opts.onlyChat) : all;
  if (!admins.length) return { sent: 0, skipped: true };
  const day = new Date(tashkentDayStart(now)).toISOString().slice(0, 10);
  if (!opts.force) {
    try {
      await rateLimit(`adminDaily:${day}`, 1, 36 * HOUR);
    } catch {
      return { sent: 0, skipped: true };
    }
  }
  const range = yesterdayRange(now);
  // Kecha vs undan oldingi kun + 7 kunlik trend (kecha bilan tugaydi)
  const [s, prev, series] = await Promise.all([collectAdminStats("today", range), collectAdminStats("today", { from: range.from - DAY, to: range.to - DAY }), collectDailySeries(7, now - DAY)]);
  // Dushanba — qo'shimcha haftalik hisobot (o'tgan 7 kun, undan oldingi 7 kun bilan taqqoslab)
  const monday = new Date(tashkentDayStart(now) + 5 * HOUR).getUTCDay() === 1;
  const week = monday ? await Promise.all([collectAdminStats("7d"), collectAdminStats("7d", prevRange("7d"))]) : null;
  // Matn tilga qarab bir marta chiziladi (kesh)
  const cache = new Map<BotLang, { text: string; weekly: string | null }>();
  const render = (lang: BotLang) => {
    let r = cache.get(lang);
    if (!r) {
      r = {
        text: renderStats(s, `🗓 <b>${L(lang, "Kunlik hisobot", "Ежедневный отчёт")} — ${fmtDate(range.from)}</b>`, { prev, series }, lang),
        weekly: week ? renderStats(week[0], L(lang, "📅 <b>Haftalik hisobot — o'tgan 7 kun</b>", "📅 <b>Недельный отчёт — прошлые 7 дней</b>"), { prev: week[1] }, lang) : null,
      };
      cache.set(lang, r);
    }
    return r;
  };
  let sent = 0;
  for (const a of admins) {
    if (!a.telegramChatId) continue;
    const lang: BotLang = a.lang === "ru" ? "ru" : "uz";
    const { text, weekly } = render(lang);
    const ok = await sendTelegram(a.telegramChatId, text, { bulk: true, keyboard: [[{ text: L(lang, "📊 Bugun", "📊 Сегодня"), data: "adm:stat:today" }, { text: L(lang, "📥 Navbat", "📥 Очередь"), data: "adm:queue" }], [panelButton("/admin", PANEL(lang))]] });
    if (ok) sent++;
    if (weekly) await sendTelegram(a.telegramChatId, weekly, { bulk: true, keyboard: [[{ text: L(lang, "30 kun", "30 дней"), data: "adm:stat:30d" }, panelButton("/admin#analitika", L(lang, "📈 Analitika", "📈 Аналитика"))]] });
  }
  return { sent, skipped: false };
}

/* ------------------------------------------------------------------ */
/* Jonli ogohlantirishlar (adminga)                                    */
/* ------------------------------------------------------------------ */
/**
 * Yangi mutaxassis profili (bot/ilova ro'yxati yoki saytda profil to'ldirilganda).
 * Avtomatik tasdiqlash yoqilgan bo'lsa (`autoVerifySpecialists`=1 — admin panel «Tasdiqlash navbati» yoki bot /navbat)
 * profil shu yerda tasdiqlanadi, egasiga «tasdiqlandi» xabari ketadi, adminlarga esa faqat MA'LUMOT (+ «Bekor qilish»).
 * O'chiq bo'lsa — avvalgidek: saytda bildirishnoma + Telegramda «Tasdiqlash» tugmasi.
 */
export async function notifyAdminsNewSpecialist(specialistId: string): Promise<void> {
  try {
    const sp = await db.query.specialists.findFirst({ where: eq(specialists.id, specialistId), columns: { id: true, userId: true, slug: true, title: true, isVerified: true }, with: { user: { columns: { name: true, email: true } } } });
    if (!sp || sp.isVerified) return;
    const { getSettings } = await import("@/lib/payments/settings");
    const auto = (await getSettings()).autoVerifySpecialists === 1 && (await autoVerifySpecialist(sp.id));
    if (auto) {
      await notify(sp.userId, "account", "Profilingiz tasdiqlandi ✅", "Profilingiz tasdiqlandi — endi katalogda «tasdiqlangan» belgisi bilan chiqasiz.", `/mutaxassislar/${sp.slug}`).catch(() => undefined);
    }
    const admins = await db.query.users.findMany({ where: and(eq(users.role, "admin"), eq(users.isBanned, false)), columns: { id: true, telegramChatId: true, lang: true } });
    const head = (lang: BotLang) => `🎨 <b>${L(lang, "Yangi mutaxassis", "Новый специалист")}:</b> ${escapeTelegramHtml(sp.user.name)} — ${escapeTelegramHtml(sp.title)}\n${escapeTelegramHtml(sp.user.email)}`;
    const text = (lang: BotLang) =>
      `${head(lang)}\n${auto ? L(lang, "✅ Avtomatik tasdiqlandi.", "✅ Подтверждён автоматически.") : L(lang, "Profilni ko'rib, tasdiqlang.", "Проверьте профиль и подтвердите.")}`;
    const profileBtn = (lang: BotLang): TelegramButton => ({ text: L(lang, "👁 Profil", "👁 Профиль"), url: `${site()}/mutaxassislar/${sp.slug}` });
    await Promise.all(
      admins.map(async (a) => {
        const lang: BotLang = a.lang === "ru" ? "ru" : "uz";
        // siteOnly: Telegramga quyida tugmali maxsus xabar ketadi (umumiy bildirishnoma ikkinchi marta bormasin)
        await notify(
          a.id,
          "account",
          `Yangi mutaxassis: ${sp.user.name}`,
          auto ? `${sp.title} — avtomatik tasdiqlandi.` : `${sp.title} — tasdiqlash navbatida.`,
          auto ? `/mutaxassislar/${sp.slug}` : "/admin#tasdiqlash",
          { siteOnly: true },
        ).catch(() => undefined);
        if (!a.telegramChatId) return;
        const keyboard: TelegramButton[][] = auto
          ? [[{ text: L(lang, "↩️ Tasdiqni bekor qilish", "↩️ Отменить подтверждение"), data: `adm:unver:${sp.id}` }, profileBtn(lang)]]
          : [[{ text: L(lang, "✅ Tasdiqlash", "✅ Подтвердить"), data: `adm:ver:${sp.id}` }, profileBtn(lang)]];
        await sendTelegram(a.telegramChatId, text(lang), { bulk: true, keyboard });
      }),
    );
  } catch (e) {
    console.error("[admin-bot:newSpecialist]", e);
  }
}

/** Avtomatik tasdiqlash (CAS: faqat hali tasdiqlanmagan profil); audit aktyorsiz, `meta.auto` bilan */
async function autoVerifySpecialist(spId: string): Promise<boolean> {
  const res = await db
    .update(specialists)
    .set({ isVerified: true, verificationRequestedAt: null, verificationNote: null, updatedAt: new Date() })
    .where(and(eq(specialists.id, spId), eq(specialists.isVerified, false)));
  if ((res.rowsAffected ?? 0) === 0) return false;
  await audit(null, "admin_verify", { targetType: "specialist", targetId: spId, meta: { auto: true } }).catch(() => undefined);
  return true;
}

/** Yangi shikoyat — adminga Telegramda TUGMALAR bilan (yopish / o'chirish / bloklash); saytdagi bildirishnomani route'ning o'zi yozadi */
export async function notifyAdminsNewReport(reportId: string): Promise<void> {
  try {
    const r = (await listAdminReports("open", 30)).find((x) => x.id === reportId);
    if (!r) return;
    const admins = await db.query.users.findMany({ where: and(eq(users.role, "admin"), eq(users.isBanned, false), isNotNull(users.telegramChatId)), columns: { telegramChatId: true, lang: true } });
    await Promise.all(
      admins.map((a) => {
        const lang: BotLang = a.lang === "ru" ? "ru" : "uz";
        return a.telegramChatId ? sendTelegram(a.telegramChatId, `🚩 <b>${L(lang, "Yangi shikoyat", "Новая жалоба")}</b>\n${reportText(r, lang)}`, { bulk: true, keyboard: reportKeyboard(r, lang) }) : Promise.resolve(false);
      }),
    );
  } catch (e) {
    console.error("[admin-bot:newReport]", e);
  }
}

/** Yangi mentor arizasi — saytda bildirishnoma + Telegramda «Tasdiqlash / Rad etish» tugmalari */
export async function notifyAdminsMentorApplied(mentorId: string): Promise<void> {
  try {
    const m = await db.query.mentors.findFirst({ where: eq(mentors.id, mentorId), columns: { id: true, headline: true, bio: true, isApproved: true }, with: { user: { columns: { name: true, email: true } } } });
    if (!m || m.isApproved) return;
    const admins = await db.query.users.findMany({ where: and(eq(users.role, "admin"), eq(users.isBanned, false)), columns: { id: true, telegramChatId: true, lang: true } });
    const text = (lang: BotLang) => [`🎓 <b>${L(lang, "Yangi mentor arizasi", "Новая заявка ментора")}:</b> ${escapeTelegramHtml(m.user.name)} — ${escapeTelegramHtml(m.headline)}`, m.bio ? `<i>${escapeTelegramHtml(m.bio.slice(0, 220))}${m.bio.length > 220 ? "…" : ""}</i>` : "", escapeTelegramHtml(m.user.email)].filter(Boolean).join("\n");
    await Promise.all(
      admins.map(async (a) => {
        const lang: BotLang = a.lang === "ru" ? "ru" : "uz";
        await notify(a.id, "account", `Mentor arizasi: ${m.user.name}`, `${m.headline} — tasdiqlash navbatida.`, "/admin/mentorlik", { siteOnly: true }).catch(() => undefined);
        if (a.telegramChatId) await sendTelegram(a.telegramChatId, text(lang), { bulk: true, keyboard: [[{ text: L(lang, "✅ Tasdiqlash", "✅ Подтвердить"), data: `adm:ma:ok:${m.id}` }, { text: L(lang, "❌ Rad etish", "❌ Отклонить"), data: `adm:ma:no:${m.id}` }], [panelButton("/admin/mentorlik", L(lang, "👁 Admin panelda", "👁 В админ-панели"))]] });
      }),
    );
  } catch (e) {
    console.error("[admin-bot:mentorApplied]", e);
  }
}

/** Kontakt sotildi — adminga daromad xabari (faqat Telegram, saytdagi ro'yxatni to'ldirmaydi) */
export async function notifyAdminsContactSold(buyerName: string, specialistName: string, amount: number): Promise<void> {
  try {
    const admins = await db.query.users.findMany({ where: and(eq(users.role, "admin"), eq(users.isBanned, false), isNotNull(users.telegramChatId)), columns: { telegramChatId: true, lang: true } });
    await Promise.all(
      admins.map((a) => {
        const lang: BotLang = a.lang === "ru" ? "ru" : "uz";
        const text = `💰 <b>${L(lang, "Kontakt sotildi", "Контакт продан")}</b> — ${formatPrice(amount)}\n${escapeTelegramHtml(buyerName)} → ${escapeTelegramHtml(specialistName)}`;
        return a.telegramChatId ? sendTelegram(a.telegramChatId, text, { bulk: true, keyboard: [[{ text: L(lang, "📊 Statistika", "📊 Статистика"), data: "adm:stat:today" }, panelButton("/admin/kontaktlar", L(lang, "Kontakt sotuvi", "Продажа контактов"))]] }) : Promise.resolve(false);
      }),
    );
  } catch (e) {
    console.error("[admin-bot:contactSold]", e);
  }
}

/* ------------------------------------------------------------------ */
/* /narx — kontakt narxlari (umumiy) va maxsus narx matni               */
/* ------------------------------------------------------------------ */
const LEVELS: Record<string, "contactPriceJunior" | "contactPriceMiddle" | "contactPriceSenior" | "contactPriceExpert"> = { junior: "contactPriceJunior", middle: "contactPriceMiddle", senior: "contactPriceSenior", expert: "contactPriceExpert", boshlangich: "contactPriceJunior", orta: "contactPriceMiddle", tajribali: "contactPriceSenior", ekspert: "contactPriceExpert" };

/** `/narx` — joriy kontakt narxlari; `/narx <daraja> <summa>` — o'zgartirish (junior|middle|senior|expert) */
export async function handleAdminPrices(chatId: string, args: string, lang?: BotLang): Promise<void> {
  const { getSettings, saveSettings } = await import("@/lib/payments/settings");
  const admin = await adminByChat(chatId);
  if (!admin) return;
  const parts = args.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const current = await getSettings();
  const show = async (prefix = "") =>
    sendTelegram(
      chatId,
      `${prefix}💰 <b>${L(lang, "Kontakt narxlari (daraja bo'yicha)", "Цены контактов (по уровню)")}</b>\n` +
        `• junior — ${formatPrice(current.contactPriceJunior)}\n• middle — ${formatPrice(current.contactPriceMiddle)}\n• senior — ${formatPrice(current.contactPriceSenior)}\n• expert — ${formatPrice(current.contactPriceExpert)}\n\n` +
        L(lang, "O'zgartirish: <code>/narx middle 60000</code>. Maxsus narx — /user ism → «💰 Maxsus narx».", "Изменить: <code>/narx middle 60000</code>. Особая цена — /user имя → «💰 Особая цена»."),
      { keyboard: [[panelButton("/admin/kontaktlar", L(lang, "Kontakt sotuvi (admin panel)", "Продажа контактов (админ-панель)"))]] },
    );
  if (parts.length < 2) {
    await show();
    return;
  }
  const key = LEVELS[parts[0].replace(/['ʼ’]/g, "")];
  // Summa bo'shliq bilan yozilishi mumkin («60 000») — qolgan BARCHA bo'laklar birlashtiriladi (ilgari faqat birinchisi olinib,
  // narx 60 so'm bo'lib qolardi va shu darajadagi har kontakt xaridi «Summa juda kichik» bilan yiqilardi)
  const raw = parts.slice(1).join("");
  const digits = raw.replace(/[\s.,_'’]/g, "");
  const amount = /^\d{1,9}$/.test(digits) ? Number(digits) : NaN;
  // 0 — bepul; aks holda kamida 1 000 so'm (to'lov tizimi undan kichik summani qabul qilmaydi)
  if (!key || !Number.isFinite(amount) || (amount !== 0 && amount < 1000) || amount > 50_000_000) {
    await sendTelegram(chatId, L(lang, "Format: <code>/narx junior|middle|senior|expert 50000</code> — summa 1 000 so'mdan kam bo'lmasin (0 — bepul).", "Формат: <code>/narx junior|middle|senior|expert 50000</code> — сумма не меньше 1 000 сум (0 — бесплатно)."));
    return;
  }
  const saved = await saveSettings({ [key]: Math.round(amount) });
  Object.assign(current, saved);
  await audit(admin.id, "admin_contact_settings", { targetType: "platform_settings", meta: { [key]: Math.round(amount), via: "telegram" } });
  await show(L(lang, "✅ Saqlandi.\n\n", "✅ Сохранено.\n\n"));
}

/** Maxsus narx oqimi: admin «💰 Maxsus narx» bosgach yozgan summa (bot_sessions flow="adminprice") */
export async function handleAdminPriceText(chatId: string, text: string, lang?: BotLang): Promise<boolean> {
  const { getBotSession, clearBotSession } = await import("@/lib/telegram-bot/session");
  const s = await getBotSession<{ specialistId: string; name: string }>(chatId);
  if (!s || s.flow !== "adminprice") return false;
  const admin = await adminByChat(chatId);
  if (!admin) {
    await clearBotSession(chatId);
    return false;
  }
  const t = text.trim().toLowerCase();
  const reset = t === "0" || t === "yoq" || t === "yo'q" || t === "umumiy";
  const amount = reset ? null : Number(t.replace(/\D/g, ""));
  if (!reset && (!Number.isFinite(amount) || (amount as number) < 1000 || (amount as number) > 50_000_000)) {
    await sendTelegram(chatId, L(lang, "Summa 1 000 – 50 000 000 so'm oralig'ida bo'lsin (yoki <code>0</code> — umumiy narx). Qaytadan yozing:", "Сумма должна быть в пределах 1 000 – 50 000 000 сум (или <code>0</code> — общая цена). Напишите ещё раз:"));
    return true;
  }
  await db.update(specialists).set({ contactPrice: amount, updatedAt: new Date() }).where(eq(specialists.id, s.data.specialistId));
  await audit(admin.id, "admin_contact_settings", { targetType: "specialist", targetId: s.data.specialistId, meta: { contactPrice: amount, via: "telegram" } });
  await clearBotSession(chatId);
  await sendTelegram(chatId, amount == null ? L(lang, `✅ ${escapeTelegramHtml(s.data.name)} — maxsus narx olib tashlandi, umumiy narx amal qiladi.`, `✅ ${escapeTelegramHtml(s.data.name)} — особая цена снята, действует общая.`) : L(lang, `✅ ${escapeTelegramHtml(s.data.name)} — kontakt narxi ${formatPrice(amount)}.`, `✅ ${escapeTelegramHtml(s.data.name)} — цена контакта ${formatPrice(amount)}.`));
  return true;
}

/* ------------------------------------------------------------------ */
/* Konkurslar                                                          */
/* ------------------------------------------------------------------ */
/**
 * /konkurs — argumentsiz joriy konkurslar ro'yxati; `/konkurs Sarlavha | Tavsif | kunlar`
 * yangi konkurs ochadi (tavsif va kunlar ixtiyoriy, standart 7 kun).
 */
export async function handleAdminChallenge(chatId: string, argText: string, lang?: BotLang): Promise<void> {
  const admin = await adminByChat(chatId);
  if (!admin) return;
  const { createChallenge, listChallenges } = await import("@/lib/challenges/service");
  const arg = argText.trim();
  if (!arg) {
    const list = await listChallenges();
    const lines = [L(lang, "🏆 <b>Konkurslar</b>", "🏆 <b>Конкурсы</b>"), ""];
    if (!list.length) lines.push(L(lang, "Hozircha konkurs yo'q.", "Конкурсов пока нет."));
    for (const c of list.slice(0, 8)) {
      const state = c.state === "open" ? L(lang, "🟢 ochiq", "🟢 открыт") : c.state === "soon" ? L(lang, "🕐 tez kunda", "🕐 скоро") : L(lang, "✔️ yakunlangan", "✔️ завершён");
      lines.push(`• <b>${escapeTelegramHtml(c.title)}</b> — ${state}, ${c.entriesCount} ${L(lang, "ta ish", "работ")}${c.winner ? ` · 🏆 ${escapeTelegramHtml(c.winner.name)}` : ""}`);
    }
    lines.push("", L(lang, "Yangi konkurs: <code>/konkurs Sarlavha | Tavsif | kunlar</code> (tavsif va kunlar ixtiyoriy, standart 7 kun)", "Новый конкурс: <code>/konkurs Название | Описание | дни</code> (описание и дни необязательны, по умолчанию 7 дней)"));
    await sendTelegram(chatId, lines.join("\n"), { keyboard: [[{ text: L(lang, "🏆 Konkurslar sahifasi", "🏆 Страница конкурсов"), url: `${site()}/konkurs` }]] });
    return;
  }
  const [title = "", description = "", daysRaw = ""] = arg.split("|").map((s) => s.trim());
  const days = daysRaw ? Number(daysRaw.replace(/\D/g, "")) : undefined;
  try {
    const c = await createChallenge(admin.id, { title, description, days });
    await audit(admin.id, "admin_challenge_create", { targetType: "challenge", targetId: c.id, meta: { title: c.title, via: "telegram" } });
    await sendTelegram(chatId, L(lang, `✅ Konkurs ochildi: <b>${escapeTelegramHtml(c.title)}</b>\nMuddat: ${fmtDate(c.endsAt.getTime())} gacha.`, `✅ Конкурс открыт: <b>${escapeTelegramHtml(c.title)}</b>\nСрок: до ${fmtDate(c.endsAt.getTime())}.`), { keyboard: [[{ text: L(lang, "🏆 Ko'rish", "🏆 Открыть"), url: `${site()}/konkurs/${c.id}` }]] });
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : L(lang, "Konkurs ochilmadi", "Конкурс не создан");
    await sendTelegram(chatId, `⚠️ ${escapeTelegramHtml(msg)}\n\n${L(lang, "Format: <code>/konkurs Sarlavha | Tavsif | kunlar</code>", "Формат: <code>/konkurs Название | Описание | дни</code>")}`);
  }
}

/** Fikr yozuvidagi «sahifa» — bot orqali qo'llab-quvvatlashga yozilgan xabar belgisi (lib/telegram-bot/support.ts) */
export const SUPPORT_PAGE = "/telegram-bot";

/** Yangi fikr (2026-11-04, /api/fikr) — adminlarga saytda bildirishnoma (emailsiz) + Telegramda bitta qisqa xabar (matn parchasi) */
export async function notifyAdminsNewFeedback(feedbackId: string): Promise<void> {
  try {
    const f = await db.query.feedbacks.findFirst({ where: eq(feedbacks.id, feedbackId) });
    if (!f) return;
    const who = f.userId ? await db.query.users.findFirst({ where: eq(users.id, f.userId), columns: { name: true } }) : null;
    // Botdan kelgan murojaat: sarlavha «Qo'llab-quvvatlash», ostida Telegram aloqasi (taxallus / chat) — admin javob yoza olsin
    const viaBot = f.page === SUPPORT_PAGE;
    const kindOf = (lang: BotLang) => (viaBot ? L(lang, "🆘 Qo'llab-quvvatlash", "🆘 Поддержка") : f.kind === "bug" ? L(lang, "🐞 Xato", "🐞 Ошибка") : f.kind === "idea" ? L(lang, "💡 G'oya", "💡 Идея") : L(lang, "💬 Fikr", "💬 Отзыв"));
    const nameOf = (lang: BotLang) => who?.name ?? L(lang, "Mehmon", "Гость");
    const excerpt = f.text.length > 300 ? `${cutPlain(f.text, 300)}…` : f.text;
    // Sayt qo'ng'irog'i (o'zbekcha manba; rus tilidagi adminga `notify()` o'zi o'giradi) — Telegramga quyida alohida, shuning uchun siteOnly
    await notifyAdmins("account", `${kindOf("uz")}: ${nameOf("uz")}`, `${cutPlain(excerpt, 160)}${f.page ? ` · ${f.page}` : ""}`, "/admin#fikrlar", { siteOnly: true }).catch(() => undefined);
    const admins = await db.query.users.findMany({ where: and(eq(users.role, "admin"), eq(users.isBanned, false), isNotNull(users.telegramChatId)), columns: { telegramChatId: true, lang: true } });
    const shot = f.screenshotUrl ? (f.screenshotUrl.startsWith("/") ? `${site()}${f.screenshotUrl}` : f.screenshotUrl) : "";
    await Promise.all(
      admins.map((a) => {
        const lang: BotLang = a.lang === "ru" ? "ru" : "uz";
        const text = [`<b>${escapeTelegramHtml(`${kindOf(lang)}: ${nameOf(lang)}`)}</b>${f.page && !viaBot ? ` — <code>${escapeTelegramHtml(f.page)}</code>` : ""}`, escapeTelegramHtml(excerpt), viaBot && f.userAgent ? `👤 ${escapeTelegramHtml(f.userAgent)}` : "", shot ? `📎 ${escapeTelegramHtml(shot)}` : ""].filter(Boolean).join("\n");
        return a.telegramChatId ? sendTelegram(a.telegramChatId, text, { bulk: true, keyboard: [[panelButton("/admin#fikrlar", L(lang, "👁 Fikrlar", "👁 Отзывы"))]] }) : Promise.resolve(false);
      }),
    );
  } catch (e) {
    console.error("[admin-bot:newFeedback]", e);
  }
}
