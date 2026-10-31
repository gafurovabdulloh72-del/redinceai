import "server-only";
import { and, desc, eq, gte, inArray, isNotNull, like, or, sql, type AnyColumn } from "drizzle-orm";
import { db } from "@/lib/db";
import { contactUnlocks, dmMessages, mentorPayouts, mentors, orders, payments, payouts, postComments, posts, reports, reviews, specialists, stories, subscriptionInvoices, users } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { bumpSessionVersion } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import { audit } from "@/lib/security/audit";
import { rateLimit } from "@/lib/security/rate-limit";
import { siteUrl } from "@/lib/security/site";
import { escapeTelegramHtml, sendTelegram, telegramApi, type TelegramButton } from "@/lib/telegram";
import { formatPrice } from "@/lib/utils";
import { tashkentDayStart } from "@/lib/jobs/server";
import { purchaseMeta } from "@/lib/mentorship/purchases";
import { contactMeta, isContactUnlock } from "@/lib/contacts/unlock";
import { appUrl, menuRows } from "@/lib/telegram-bot/ui";
import { listAdminReports, type AdminReportRow } from "@/app/admin/queries";
import { listPendingMentors, setMentorApproved } from "@/lib/mentorship/service";
import { deleteComment, deletePost } from "@/lib/groups/service";
import { recalcRating } from "@/lib/queries";

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
 */
type Answer = (text: string) => Promise<unknown>;
export type StatPeriod = "today" | "7d" | "30d";
const PERIOD_LABEL: Record<StatPeriod, string> = { today: "Bugun", "7d": "7 kun", "30d": "30 kun" };
const HOUR = 3600_000;
const DAY = 24 * HOUR;
const site = () => siteUrl() ?? "";
const n = (v: unknown) => Number(v ?? 0);

/** Chatga ulangan ADMIN (bo'lmasa null) */
export async function adminByChat(chatId: string): Promise<{ id: string; name: string } | null> {
  const u = await db.query.users.findFirst({ where: eq(users.telegramChatId, chatId), columns: { id: true, name: true, role: true, isBanned: true } });
  return u && u.role === "admin" && !u.isBanned ? { id: u.id, name: u.name } : null;
}

/** Admin panel tugmasi: https bo'lsa Mini App, bo'lmasa oddiy havola */
function panelButton(path = "/admin", text = "🛠 Admin panel"): TelegramButton {
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
  queue: { pendingSpecialists: number; manualPayments: number; manualInvoices: number; reports: number; disputes: number; payouts: number; mentorPayouts: number; mentorApps: number };
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
  return { pendingSpecialists: sp, manualPayments: mp, manualInvoices: mi, reports: rp, disputes: ds, payouts: po, mentorPayouts: mpo, mentorApps: ma };
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
export function trend(cur: number, prev: number): string {
  if (prev <= 0) return cur > 0 ? "▲ yangi" : "=";
  const pct = Math.round(((cur - prev) / prev) * 100);
  return pct === 0 ? "=" : `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct)}%`;
}
const shortSum = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")} mln` : v >= 1000 ? `${Math.round(v / 1000)} ming` : String(v));
const sumOf = (sr: DailyPoint[], key: keyof Omit<DailyPoint, "day">) => sr.reduce((a, x) => a + x[key], 0);

/** `cmp.prev` — oldingi davr (qavsda ▲/▼ foiz), `cmp.series` — kunlik trend (mini-grafik) */
export function renderStats(s: AdminStats, title?: string, cmp?: { prev?: AdminStats; series?: DailyPoint[] }): string {
  const q = s.queue;
  const queueTotal = q.pendingSpecialists + q.manualPayments + q.manualInvoices + q.reports + q.disputes + q.payouts + q.mentorPayouts + q.mentorApps;
  const head = title ?? `📊 <b>Statistika — ${PERIOD_LABEL[s.period]}</b> (${s.period === "today" ? fmtDate(s.to) : `${fmtDate(s.from)} – ${fmtDate(s.to)}`})`;
  const d = (cur: number, pick: (x: AdminStats) => number) => (cmp?.prev ? ` (${trend(cur, pick(cmp.prev))})` : "");
  const lines = [
    head,
    "",
    `👥 <b>Foydalanuvchilar:</b> +${s.users.newTotal}${d(s.users.newTotal, (x) => x.users.newTotal)} (jami ${s.users.total}) · mutaxassis +${s.users.newSpecialists} · mijoz +${s.users.newClients}`,
    `🟢 Faol: ${s.users.active} · Telegram ulangan: ${s.users.telegram}`,
    `🎨 <b>Mutaxassislar:</b> ${s.specialists.listed} katalogda · ${s.specialists.verified} tasdiqlangan · ${s.specialists.pending} tasdiq kutmoqda`,
    `📦 <b>Buyurtmalar:</b> ${s.orders.created} yangi${d(s.orders.created, (x) => x.orders.created)} · ${s.orders.done} bajarildi · eskrou ${formatPrice(s.orders.escrowPaid)}`,
    `💰 <b>Tushum:</b> ${formatPrice(s.revenue.total)}${d(s.revenue.total, (x) => x.revenue.total)}`,
    `   obuna ${formatPrice(s.revenue.subscriptions)} · kontakt ${formatPrice(s.revenue.contacts)} (${s.revenue.contactsCount} ta) · mentorlik ${formatPrice(s.revenue.mentorship)} · komissiya ${formatPrice(s.orders.commission)}`,
    `📝 <b>Kontent:</b> ${s.content.posts} post${d(s.content.posts, (x) => x.content.posts)} · ${s.content.stories} story · ${s.content.dms} xabar`,
  ];
  if (cmp?.prev) lines.push(`<i>Qavsda — oldingi ${s.period === "today" ? "kunning shu vaqtiga" : PERIOD_LABEL[s.period] + "ga"} nisbatan</i>`);
  const sr = cmp?.series;
  if (sr?.length) {
    lines.push(
      "",
      `📈 <b>Trend — ${sr.length} kun</b> (${sr[0].day} → ${sr[sr.length - 1].day})`,
      `👥 ${sparkline(sr.map((x) => x.users))} ${sumOf(sr, "users")} foydalanuvchi`,
      `📦 ${sparkline(sr.map((x) => x.orders))} ${sumOf(sr, "orders")} buyurtma`,
      `📝 ${sparkline(sr.map((x) => x.posts))} ${sumOf(sr, "posts")} post`,
      `💰 ${sparkline(sr.map((x) => x.revenue))} ${shortSum(sumOf(sr, "revenue"))} so'm tushum`,
    );
  }
  lines.push("", `📥 <b>Navbat (${queueTotal}):</b> ${q.pendingSpecialists} tasdiq · ${q.manualPayments + q.manualInvoices} o'tkazma · ${q.reports} shikoyat · ${q.disputes} nizo · ${q.payouts + q.mentorPayouts} payout · ${q.mentorApps} mentor arizasi`);
  return lines.join("\n");
}

function statsKeyboard(period: StatPeriod): TelegramButton[][] {
  const periods = (["today", "7d", "30d"] as StatPeriod[]).map((p) => ({ text: p === period ? `• ${PERIOD_LABEL[p]} •` : PERIOD_LABEL[p], data: `adm:stat:${p}` }));
  return [periods, [{ text: "📥 Navbat", data: "adm:queue" }, { text: "💳 To'lovlar", data: "adm:pay" }], [{ text: "🚩 Shikoyatlar", data: "adm:reports" }, { text: "🎓 Mentorlar", data: "adm:mentors" }], [panelButton()]];
}

/** /stat — statistika (msgId berilsa o'sha xabar tahrirlanadi) */
export async function sendAdminStats(chatId: string, period: StatPeriod = "today", msgId: number | null = null): Promise<void> {
  const [s, prev, series] = await Promise.all([collectAdminStats(period), collectAdminStats(period, prevRange(period)), collectDailySeries(period === "30d" ? 30 : 7)]);
  const text = renderStats(s, undefined, { prev, series });
  if (msgId) {
    const r = await telegramApi("editMessageText", { chat_id: chatId, message_id: msgId, text, parse_mode: "HTML", reply_markup: { inline_keyboard: toInline(statsKeyboard(period)) } });
    if (r?.ok) return;
  }
  await sendTelegram(chatId, text, { keyboard: statsKeyboard(period) });
}

function toInline(rows: TelegramButton[][]) {
  return rows.map((row) => row.map((b) => (b.webApp ? { text: b.text, web_app: { url: b.webApp } } : b.url ? { text: b.text, url: b.url } : { text: b.text, callback_data: b.data ?? "noop" })));
}

/* ------------------------------------------------------------------ */
/* Menyu, navbat, to'lovlar                                            */
/* ------------------------------------------------------------------ */
export async function sendAdminMenu(chatId: string): Promise<void> {
  const q = await collectQueueCounts();
  const total = q.pendingSpecialists + q.manualPayments + q.manualInvoices + q.reports + q.disputes + q.payouts + q.mentorPayouts + q.mentorApps;
  await sendTelegram(
    chatId,
    `🛠 <b>Admin menyu</b>\n${total > 0 ? `📥 Navbatda <b>${total}</b> ta ish bor.` : "📥 Navbat bo'sh ✅"}\n\n/stat — statistika va trend · /navbat — tasdiq navbati · /tolovlar — o'tkazmalar · /shikoyatlar — shikoyatlar · /mentorlar — mentor arizalari · /user ism — foydalanuvchi · /narx — kontakt narxlari · /elon — ommaviy e'lon`,
    {
      keyboard: [
        [{ text: "📊 Statistika", data: "adm:stat:today" }, { text: `📥 Navbat${total ? ` (${total})` : ""}`, data: "adm:queue" }],
        [{ text: `💳 To'lovlar${q.manualPayments + q.manualInvoices ? ` (${q.manualPayments + q.manualInvoices})` : ""}`, data: "adm:pay" }, { text: `🚩 Shikoyatlar${q.reports ? ` (${q.reports})` : ""}`, data: "adm:reports" }],
        [{ text: `🎓 Mentor arizalari${q.mentorApps ? ` (${q.mentorApps})` : ""}`, data: "adm:mentors" }, { text: "📣 E'lon", data: "adm:elon" }],
        [panelButton()],
      ],
      // Doimiy menyuga «🛠 Admin» qatori qo'shiladi
    },
  );
  await telegramApi("sendMessage", { chat_id: chatId, text: "Pastdagi menyuda «🛠 Admin» tugmasi bor 👇", reply_markup: { keyboard: menuRows(true).map((row) => row.map((b) => (typeof b === "string" ? { text: b } : "webApp" in b ? { text: b.text, web_app: { url: b.webApp } } : { text: b.text }))), resize_keyboard: true, is_persistent: true } });
}

/** /navbat — tasdiq kutayotganlar, tezkor amallar bilan */
export async function sendAdminQueues(chatId: string): Promise<void> {
  const q = await collectQueueCounts();
  const pendingSp = await db.query.specialists.findMany({ where: and(eq(specialists.isVerified, false), eq(specialists.isHidden, false)), orderBy: [desc(specialists.createdAt)], limit: 5, with: { user: { columns: { name: true, email: true } } } });
  const lines = [
    "📥 <b>Tasdiq navbati</b>",
    "",
    `🎨 Mutaxassislar tasdig'i: <b>${q.pendingSpecialists}</b>`,
    `💳 Qo'lda o'tkazmalar: <b>${q.manualPayments + q.manualInvoices}</b> (buyurtma ${q.manualPayments}, obuna/kontakt/kurs ${q.manualInvoices})`,
    `🚩 Ochiq shikoyatlar: <b>${q.reports}</b>`,
    `⚖️ Ochiq nizolar: <b>${q.disputes}</b>`,
    `💸 Payout so'rovlari: <b>${q.payouts}</b> · mentor yechish: <b>${q.mentorPayouts}</b>`,
    `🎓 Mentor arizalari: <b>${q.mentorApps}</b>`,
  ];
  const keyboard: TelegramButton[][] = [];
  if (q.manualPayments + q.manualInvoices > 0) keyboard.push([{ text: `💳 O'tkazmalarni ko'rish (${q.manualPayments + q.manualInvoices})`, data: "adm:pay" }]);
  if (q.reports > 0) keyboard.push([{ text: `🚩 Shikoyatlarni ko'rish (${q.reports})`, data: "adm:reports" }]);
  if (q.disputes > 0) keyboard.push([panelButton("/admin#nizolar", `⚖️ Nizolar (${q.disputes})`)]);
  if (q.payouts > 0) keyboard.push([panelButton("/admin#payoutlar", `💸 Payoutlar (${q.payouts})`)]);
  if (q.mentorApps > 0) keyboard.push([{ text: `🎓 Mentor arizalari (${q.mentorApps})`, data: "adm:mentors" }]);
  if (q.mentorPayouts > 0) keyboard.push([panelButton("/admin/mentorlik", `💸 Mentor yechish so'rovlari (${q.mentorPayouts})`)]);
  keyboard.push([panelButton()]);
  await sendTelegram(chatId, lines.join("\n"), { keyboard });
  // Mutaxassislar — har biri alohida xabar, «Tasdiqlash» tugmasi bilan
  for (const sp of pendingSp) {
    await sendTelegram(chatId, `🎨 <b>${escapeTelegramHtml(sp.user.name)}</b> — ${escapeTelegramHtml(sp.title)}\n${escapeTelegramHtml(sp.user.email)} · ${fmtDate(sp.createdAt.getTime())}`, {
      keyboard: [
        [
          { text: "✅ Tasdiqlash", data: `adm:ver:${sp.id}` },
          { text: "👁 Profil", url: `${site()}/mutaxassislar/${sp.slug}` },
        ],
      ],
    });
  }
  if (q.pendingSpecialists > pendingSp.length) await sendTelegram(chatId, `… va yana ${q.pendingSpecialists - pendingSp.length} ta — admin panelda.`, { keyboard: [[panelButton("/admin#tasdiqlash", "Barchasini ko'rish")]] });
}

/** /tolovlar — kutilayotgan qo'lda o'tkazmalar, tasdiqlash/rad etish tugmalari (mp: — webhook'dagi mavjud oqim) */
export async function sendAdminPayments(chatId: string): Promise<void> {
  const [pay, inv] = await Promise.all([
    db.query.payments.findMany({ where: and(eq(payments.state, "pending"), eq(payments.provider, "manual")), orderBy: [desc(payments.createdAt)], limit: 8, with: { order: { columns: { title: true } }, client: { columns: { name: true } } } }),
    db.query.subscriptionInvoices.findMany({ where: and(eq(subscriptionInvoices.state, "pending"), eq(subscriptionInvoices.provider, "manual")), orderBy: [desc(subscriptionInvoices.createdAt)], limit: 8 }),
  ]);
  if (!pay.length && !inv.length) {
    await sendTelegram(chatId, "💳 Kutilayotgan qo'lda o'tkazma yo'q ✅");
    return;
  }
  const userIds = inv.map((i) => i.userId).filter((x): x is string => Boolean(x));
  const buyers = userIds.length ? await db.query.users.findMany({ where: inArray(users.id, userIds), columns: { id: true, name: true } }) : [];
  const bmap = new Map(buyers.map((b) => [b.id, b.name]));
  await sendTelegram(chatId, `💳 <b>Kutilayotgan o'tkazmalar:</b> ${pay.length + inv.length} ta. Har birini tekshirib tasdiqlang yoki rad eting.`);
  for (const p of pay) {
    await sendTelegram(chatId, `📦 <b>Buyurtma to'lovi</b> — ${formatPrice(p.amount)}\n«${escapeTelegramHtml(p.order?.title ?? "Buyurtma")}» · ${escapeTelegramHtml(p.client?.name ?? "Mijoz")} · ${fmtDate(p.createdAt.getTime())}`, {
      keyboard: [[{ text: "✅ Tasdiqlash", data: `mp:ok:p:${p.id}` }, { text: "❌ Rad etish", data: `mp:no:p:${p.id}` }]],
    });
  }
  for (const i of inv) {
    const kind = (i.meta as { kind?: string } | null)?.kind;
    const title = isContactUnlock(i) ? contactMeta(i).title : kind === "purchase" ? purchaseMeta(i).title : `${i.months} oylik obuna`;
    const icon = isContactUnlock(i) ? "🔓" : kind === "purchase" ? "🎓" : "💠";
    const receipt = (i.meta as { receiptUrl?: string } | null)?.receiptUrl;
    const keyboard: TelegramButton[][] = [[{ text: "✅ Tasdiqlash", data: `mp:ok:s:${i.id}` }, { text: "❌ Rad etish", data: `mp:no:s:${i.id}` }]];
    if (receipt && /^https?:\/\//.test(receipt)) keyboard.push([{ text: "🧾 Chek", url: receipt }]);
    await sendTelegram(chatId, `${icon} <b>${escapeTelegramHtml(title)}</b> — ${formatPrice(i.amount)}\n${escapeTelegramHtml(i.userId ? (bmap.get(i.userId) ?? "Foydalanuvchi") : "—")} · ${fmtDate(i.createdAt.getTime())}${receipt ? " · chek bor" : ""}`, { keyboard });
  }
}

/* ------------------------------------------------------------------ */
/* Shikoyatlar va mentor arizalari — chatning o'zida hal qilinadi      */
/* ------------------------------------------------------------------ */
const REPORT_TYPE: Record<AdminReportRow["targetType"], string> = { specialist: "Profil", review: "Sharh", user: "Foydalanuvchi (chat)", post: "Post", comment: "Izoh", message: "Xabar" };
const targetExists = (r: AdminReportRow) => Boolean(r.target && !r.target.label.startsWith("O'chirilgan"));

function reportText(r: AdminReportRow): string {
  const lines = [`🚩 <b>${REPORT_TYPE[r.targetType]} shikoyati</b> · ${fmtDate(r.createdAt)}`, `Sabab: ${escapeTelegramHtml(r.reason)}`];
  if (r.target) lines.push(`Nishon: <b>${escapeTelegramHtml(r.target.label)}</b>${r.target.snippet ? ` — <i>${escapeTelegramHtml(r.target.snippet.slice(0, 140))}</i>` : ""}`);
  if (r.owner?.isBanned) lines.push("Muallif allaqachon bloklangan 🚫");
  lines.push(`Shikoyatchi: ${escapeTelegramHtml(r.reporter.name)}`);
  return lines.join("\n");
}

function reportKeyboard(r: AdminReportRow): TelegramButton[][] {
  const first: TelegramButton[] = [{ text: "✅ Yopish", data: `adm:rep:close:${r.id}` }];
  // Post/izoh/sharh — kontentni o'chirib, shikoyatni yopish (xabar va profil — faqat yopish/bloklash)
  if ((r.targetType === "post" || r.targetType === "comment" || r.targetType === "review") && targetExists(r)) first.push({ text: "🗑 O'chirish + yopish", data: `adm:rep:del:${r.id}` });
  const rows: TelegramButton[][] = [first];
  const second: TelegramButton[] = [];
  if (r.owner && !r.owner.isBanned) second.push({ text: "🚫 Muallifni bloklash", data: `adm:ban:${r.owner.userId}` });
  if (r.target?.href) second.push({ text: "👁 Ko'rish", url: `${site()}${r.target.href}` });
  if (second.length) rows.push(second);
  return rows;
}

/** /shikoyatlar — ochiq shikoyatlar, har biri alohida xabar: yopish / o'chirish / bloklash */
export async function sendAdminReports(chatId: string): Promise<void> {
  const [rows, total] = await Promise.all([listAdminReports("open", 5), db.select({ c: sql<number>`count(*)` }).from(reports).where(eq(reports.status, "open")).then((r) => n(r[0]?.c))]);
  if (!rows.length) {
    await sendTelegram(chatId, "🚩 Ochiq shikoyat yo'q ✅");
    return;
  }
  await sendTelegram(chatId, `🚩 <b>Ochiq shikoyatlar:</b> ${total} ta. Har birini ko'rib chiqing — yoping, kontentni o'chiring yoki muallifni bloklang.`);
  for (const r of rows) await sendTelegram(chatId, reportText(r), { keyboard: reportKeyboard(r) });
  if (total > rows.length) await sendTelegram(chatId, `… va yana ${total - rows.length} ta — admin panelda.`, { keyboard: [[panelButton("/admin#shikoyatlar", "Barchasini ko'rish")]] });
}

/** /mentorlar — tasdiq kutayotgan mentor arizalari: tasdiqlash / rad etish */
export async function sendAdminMentorApps(chatId: string): Promise<void> {
  const all = await listPendingMentors();
  if (!all.length) {
    await sendTelegram(chatId, "🎓 Kutilayotgan mentor arizasi yo'q ✅");
    return;
  }
  const rows = all.slice(0, 5);
  await sendTelegram(chatId, `🎓 <b>Mentor arizalari:</b> ${all.length} ta. Tasdiqlangan mentor kurs ochadi va dars beradi.`);
  for (const m of rows) {
    const text = [
      `🎓 <b>${escapeTelegramHtml(m.user.name)}</b> — ${escapeTelegramHtml(m.headline)}`,
      m.bio ? `<i>${escapeTelegramHtml(m.bio.slice(0, 220))}${m.bio.length > 220 ? "…" : ""}</i>` : "",
      `${escapeTelegramHtml(m.user.email)}${m.appliedAt ? ` · ${fmtDate(m.appliedAt)}` : ""}`,
    ].filter(Boolean);
    await sendTelegram(chatId, text.join("\n"), { keyboard: [[{ text: "✅ Tasdiqlash", data: `adm:ma:ok:${m.id}` }, { text: "❌ Rad etish", data: `adm:ma:no:${m.id}` }], [panelButton("/admin/mentorlik", "👁 Admin panelda")]] });
  }
  if (all.length > rows.length) await sendTelegram(chatId, `… va yana ${all.length - rows.length} ta — admin panelda.`, { keyboard: [[panelButton("/admin/mentorlik", "Barchasini ko'rish")]] });
}

/** Shikoyat nishonini o'chirish (post/izoh/sharh) — admin panel bilan bir xil mantiq */
async function deleteReportTarget(r: { targetType: AdminReportRow["targetType"]; targetId: string }, adminId: string): Promise<string> {
  if (r.targetType === "post") {
    const post = await db.query.posts.findFirst({ where: eq(posts.id, r.targetId) });
    if (!post) return "Post allaqachon o'chirilgan";
    await deletePost(post);
    await audit(adminId, "post_delete", { targetType: "post", targetId: post.id, meta: { authorId: post.authorId, via: "telegram" } });
    return "Post o'chirildi 🗑";
  }
  if (r.targetType === "comment") {
    const c = await db.query.postComments.findFirst({ where: eq(postComments.id, r.targetId) });
    const post = c ? await db.query.posts.findFirst({ where: eq(posts.id, c.postId) }) : null;
    if (!c || !post) return "Izoh allaqachon o'chirilgan";
    await deleteComment(c, post);
    await audit(adminId, "comment_delete", { targetType: "comment", targetId: c.id, meta: { authorId: c.authorId, via: "telegram" } });
    return "Izoh o'chirildi 🗑";
  }
  if (r.targetType === "review") {
    const row = await db.query.reviews.findFirst({ where: eq(reviews.id, r.targetId), columns: { id: true, specialistId: true, authorId: true, rating: true } });
    if (!row) return "Sharh allaqachon o'chirilgan";
    await db.delete(reviews).where(eq(reviews.id, row.id));
    await recalcRating(row.specialistId);
    await audit(adminId, "review_deleted", { targetType: "review", targetId: row.id, meta: { admin: true, specialistId: row.specialistId, authorId: row.authorId, rating: row.rating, via: "telegram" } });
    return "Sharh o'chirildi, reyting qayta hisoblandi 🗑";
  }
  throw new ApiError(400, "Bu turdagi nishon botdan o'chirilmaydi — admin panelda ko'ring");
}

/* ------------------------------------------------------------------ */
/* Foydalanuvchi qidirish va bloklash                                  */
/* ------------------------------------------------------------------ */
const ROLE: Record<string, string> = { client: "Mijoz", specialist: "Mutaxassis", admin: "Admin" };

export async function handleAdminUserSearch(chatId: string, q: string): Promise<void> {
  const needle = q.trim().replace(/^@/, "").toLowerCase();
  if (needle.length < 2) {
    await sendTelegram(chatId, "Qidirish: <code>/user ism</code>, <code>/user email</code> yoki <code>/user @taxallus</code>");
    return;
  }
  const term = `%${needle.replace(/[%_]/g, (c) => `\\${c}`)}%`;
  const rows = await db.query.users.findMany({
    where: or(sql`lower(${users.name}) like ${term} escape '\\'`, sql`lower(${users.email}) like ${term} escape '\\'`, sql`lower(coalesce(${users.username}, '')) like ${term} escape '\\'`, like(users.phone, term)),
    orderBy: [desc(users.createdAt)],
    limit: 5,
    columns: { id: true, name: true, email: true, role: true, isBanned: true, bannedReason: true, username: true, createdAt: true, telegramChatId: true, lastSeenAt: true },
    with: { specialist: { columns: { slug: true, isVerified: true, isHidden: true } } },
  });
  if (!rows.length) {
    await sendTelegram(chatId, `«${escapeTelegramHtml(q.trim())}» bo'yicha hech kim topilmadi.`);
    return;
  }
  for (const u of rows) {
    const lines = [
      `👤 <b>${escapeTelegramHtml(u.name)}</b> — ${ROLE[u.role] ?? u.role}${u.isBanned ? " · 🚫 BLOKLANGAN" : ""}`,
      `${escapeTelegramHtml(u.email)}${u.username ? ` · @${escapeTelegramHtml(u.username)}` : ""}`,
      `Ro'yxatdan: ${fmtDate(u.createdAt.getTime())}${u.lastSeenAt ? ` · so'nggi faollik ${fmtDate(u.lastSeenAt.getTime())}` : ""} · Telegram ${u.telegramChatId ? "ulangan" : "yo'q"}`,
      u.specialist ? `Profil: ${u.specialist.isHidden ? "yashirin" : u.specialist.isVerified ? "tasdiqlangan ✅" : "tasdiq kutmoqda"}` : "",
      u.isBanned && u.bannedReason ? `Sabab: ${escapeTelegramHtml(u.bannedReason)}` : "",
    ].filter(Boolean);
    const keyboard: TelegramButton[][] = [];
    if (u.role !== "admin") keyboard.push([u.isBanned ? { text: "✅ Blokdan chiqarish", data: `adm:unban:${u.id}` } : { text: "🚫 Bloklash", data: `adm:ban:${u.id}` }]);
    // Kontakt sotuvi: rejim va maxsus narx — mutaxassis profili bo'lsa
    if (u.specialist?.slug) keyboard.push([{ text: "🔓 Sotilsin", data: `adm:cm:${u.id}:paid` }, { text: "🔒 Faqat portfolio", data: `adm:cm:${u.id}:hidden` }, { text: "💰 Maxsus narx", data: `adm:cp:${u.id}` }]);
    const row: TelegramButton[] = [panelButton(`/admin#foydalanuvchilar`, "Admin panel")];
    if (u.specialist?.slug) row.push({ text: "Ommaviy profil", url: `${site()}/mutaxassislar/${u.specialist.slug}` });
    keyboard.push(row);
    await sendTelegram(chatId, lines.join("\n"), { keyboard });
  }
}

/* ------------------------------------------------------------------ */
/* Tugmalar: adm:*                                                     */
/* ------------------------------------------------------------------ */
export async function handleAdminCallback(chatId: string, data: string, answer: Answer, msgId: number | null): Promise<boolean> {
  if (!data.startsWith("adm:")) return false;
  const admin = await adminByChat(chatId);
  if (!admin) {
    await answer("Faqat administrator uchun");
    return true;
  }
  let m: RegExpExecArray | null;
  try {
    if ((m = /^adm:stat:(today|7d|30d)$/.exec(data))) {
      await answer("");
      await sendAdminStats(chatId, m[1] as StatPeriod, msgId);
      return true;
    }
    if (data === "adm:queue") {
      await answer("");
      await sendAdminQueues(chatId);
      return true;
    }
    if (data === "adm:pay") {
      await answer("");
      await sendAdminPayments(chatId);
      return true;
    }
    if (data === "adm:reports") {
      await answer("");
      await sendAdminReports(chatId);
      return true;
    }
    if (data === "adm:mentors") {
      await answer("");
      await sendAdminMentorApps(chatId);
      return true;
    }
    if ((m = /^adm:rep:(close|del):([\w-]{1,64})$/.exec(data))) {
      const r = await db.query.reports.findFirst({ where: eq(reports.id, m[2]), columns: { id: true, status: true, targetType: true, targetId: true } });
      if (!r) {
        await answer("Shikoyat topilmadi");
        return true;
      }
      let note = "";
      if (m[1] === "del") note = await deleteReportTarget(r, admin.id);
      if (r.status === "open") {
        // Bir xil nishon bo'yicha barcha ochiq shikoyatlar birga yopiladi (kontent o'chirilganda ham mantiqiy)
        await db
          .update(reports)
          .set({ status: "closed", resolvedBy: admin.id })
          .where(m[1] === "del" ? and(eq(reports.targetType, r.targetType), eq(reports.targetId, r.targetId), eq(reports.status, "open")) : eq(reports.id, r.id));
        await audit(admin.id, "admin_report_closed", { targetType: "report", targetId: r.id, meta: { target: `${r.targetType}:${r.targetId}`, via: "telegram", deleted: m[1] === "del" } });
      }
      await answer(note || (r.status === "open" ? "Yopildi ✅" : "Allaqachon yopilgan"));
      if (msgId) await telegramApi("editMessageText", { chat_id: chatId, message_id: msgId, text: `✅ <b>${REPORT_TYPE[r.targetType]} shikoyati yopildi</b>${note ? ` · ${escapeTelegramHtml(note)}` : ""} · ${escapeTelegramHtml(admin.name)}`, parse_mode: "HTML" });
      return true;
    }
    if ((m = /^adm:ma:(ok|no):([\w-]{1,64})$/.exec(data))) {
      const approve = m[1] === "ok";
      const mentor = await db.query.mentors.findFirst({ where: eq(mentors.id, m[2]), columns: { id: true, isApproved: true }, with: { user: { columns: { name: true } } } });
      if (!mentor) {
        await answer("Ariza topilmadi (rad etilgan bo'lishi mumkin)");
        return true;
      }
      if (mentor.isApproved) {
        await answer("Allaqachon tasdiqlangan ✓");
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
      await answer(approve ? "Mentor tasdiqlandi 🎓" : "Ariza rad etildi");
      if (msgId) await telegramApi("editMessageText", { chat_id: chatId, message_id: msgId, text: `${approve ? "✅" : "❌"} <b>${escapeTelegramHtml(mentor.user.name)}</b> — ${approve ? "mentor sifatida tasdiqlandi" : "arizasi rad etildi"} · ${escapeTelegramHtml(admin.name)}`, parse_mode: "HTML" });
      return true;
    }
    if (data === "adm:menu") {
      await answer("");
      await sendAdminMenu(chatId);
      return true;
    }
    if (data === "adm:elon") {
      await answer("");
      const { handleBroadcastStart } = await import("@/lib/telegram-bot/actions");
      await handleBroadcastStart(chatId, "/elon");
      return true;
    }
    if ((m = /^adm:ver:([\w-]{1,64})$/.exec(data))) {
      const sp = await db.query.specialists.findFirst({ where: eq(specialists.id, m[1]), columns: { id: true, userId: true, isVerified: true, slug: true }, with: { user: { columns: { name: true } } } });
      if (!sp) {
        await answer("Profil topilmadi");
        return true;
      }
      if (sp.isVerified) {
        await answer("Allaqachon tasdiqlangan ✓");
        return true;
      }
      await db.update(specialists).set({ isVerified: true, updatedAt: new Date() }).where(eq(specialists.id, sp.id));
      await audit(admin.id, "admin_verify", { targetType: "specialist", targetId: sp.id, meta: { via: "telegram" } });
      await notify(sp.userId, "account", "Profilingiz tasdiqlandi ✅", "Administrator profilingizni ko'rib chiqdi va tasdiqladi — endi katalogda «tasdiqlangan» belgisi bilan chiqasiz.", `/mutaxassislar/${sp.slug}`).catch(() => undefined);
      await answer("Tasdiqlandi ✅");
      if (msgId) await telegramApi("editMessageText", { chat_id: chatId, message_id: msgId, text: `✅ <b>${escapeTelegramHtml(sp.user.name)}</b> tasdiqlandi · ${escapeTelegramHtml(admin.name)}`, parse_mode: "HTML" });
      return true;
    }
    if ((m = /^adm:cm:([\w-]{1,64}):(paid|hidden)$/.exec(data))) {
      const sp = await db.query.specialists.findFirst({ where: eq(specialists.userId, m[1]), columns: { id: true, contactMode: true } });
      if (!sp) {
        await answer("Mutaxassis profili yo'q");
        return true;
      }
      const mode = m[2] as "paid" | "hidden";
      if (sp.contactMode !== mode) {
        await db.update(specialists).set({ contactMode: mode, updatedAt: new Date() }).where(eq(specialists.id, sp.id));
        await audit(admin.id, "admin_contact_settings", { targetType: "specialist", targetId: sp.id, meta: { contactMode: mode, via: "telegram" } });
      }
      await answer(mode === "paid" ? "Kontakt sotiladi 🔓" : "Faqat portfolio 🔒");
      return true;
    }
    if ((m = /^adm:cp:([\w-]{1,64})$/.exec(data))) {
      const sp = await db.query.specialists.findFirst({ where: eq(specialists.userId, m[1]), columns: { id: true, contactPrice: true, experience: true }, with: { user: { columns: { name: true } } } });
      if (!sp) {
        await answer("Mutaxassis profili yo'q");
        return true;
      }
      const { setBotSession } = await import("@/lib/telegram-bot/session");
      await setBotSession(chatId, "adminprice", "amount", { specialistId: sp.id, name: sp.user.name });
      await answer("");
      await sendTelegram(chatId, `💰 <b>${escapeTelegramHtml(sp.user.name)}</b> uchun maxsus kontakt narxini yozing (so'm, masalan <code>75000</code>). Umumiy narxga qaytarish — <code>0</code> yoki <code>yoq</code>. Hozir: ${sp.contactPrice == null ? "umumiy (daraja bo'yicha)" : formatPrice(sp.contactPrice)}.`);
      return true;
    }
    if ((m = /^adm:(ban|unban):([\w-]{1,64})$/.exec(data))) {
      const ban = m[1] === "ban";
      const u = await db.query.users.findFirst({ where: eq(users.id, m[2]), columns: { id: true, name: true, role: true, isBanned: true } });
      if (!u) {
        await answer("Foydalanuvchi topilmadi");
        return true;
      }
      if (u.role === "admin" || u.id === admin.id) {
        await answer("Administratorni bloklab bo'lmaydi");
        return true;
      }
      if (u.isBanned === ban) {
        await answer(ban ? "Allaqachon bloklangan" : "Bloklanmagan");
        return true;
      }
      const why = ban ? "Administrator tomonidan Telegram orqali bloklandi" : null;
      await db.update(users).set({ isBanned: ban, bannedReason: why }).where(eq(users.id, u.id));
      if (ban) await bumpSessionVersion(u.id);
      await audit(admin.id, ban ? "admin_ban" : "admin_unban", { targetType: "user", targetId: u.id, meta: { reason: why ?? undefined, name: u.name, via: "telegram" } });
      await notify(u.id, "account", ban ? "Hisobingiz bloklandi" : "Hisobingiz blokdan chiqarildi", ban ? `Sabab: ${why}. Savollar bo'lsa qo'llab-quvvatlash bilan bog'laning.` : "Platformadan yana to'liq foydalanishingiz mumkin.", "/kabinet").catch(() => undefined);
      await answer(ban ? "Bloklandi 🚫" : "Blokdan chiqarildi ✅");
      if (msgId) {
        await telegramApi("editMessageReplyMarkup", { chat_id: chatId, message_id: msgId, reply_markup: { inline_keyboard: toInline([[ban ? { text: "✅ Blokdan chiqarish", data: `adm:unban:${u.id}` } : { text: "🚫 Bloklash", data: `adm:ban:${u.id}` }]]) } });
      }
      return true;
    }
  } catch (e) {
    await answer(e instanceof ApiError ? e.message : "Xatolik — admin panelda ko'rib chiqing");
    return true;
  }
  await answer("Noma'lum amal");
  return true;
}

/* ------------------------------------------------------------------ */
/* Kunlik hisobot (cron)                                               */
/* ------------------------------------------------------------------ */
/** Har admin Telegramiga kechagi kun hisoboti — bir kunda bir marta (rate_limits CAS) */
export async function sendAdminDailyReport(now = Date.now()): Promise<{ sent: number; skipped: boolean }> {
  const admins = await db.query.users.findMany({ where: and(eq(users.role, "admin"), isNotNull(users.telegramChatId), eq(users.isBanned, false)), columns: { id: true, telegramChatId: true } });
  if (!admins.length) return { sent: 0, skipped: true };
  const day = new Date(tashkentDayStart(now)).toISOString().slice(0, 10);
  try {
    await rateLimit(`adminDaily:${day}`, 1, 36 * HOUR);
  } catch {
    return { sent: 0, skipped: true };
  }
  const range = yesterdayRange(now);
  // Kecha vs undan oldingi kun + 7 kunlik trend (kecha bilan tugaydi)
  const [s, prev, series] = await Promise.all([collectAdminStats("today", range), collectAdminStats("today", { from: range.from - DAY, to: range.to - DAY }), collectDailySeries(7, now - DAY)]);
  const text = renderStats(s, `🗓 <b>Kunlik hisobot — ${fmtDate(range.from)}</b>`, { prev, series });
  // Dushanba — qo'shimcha haftalik hisobot (o'tgan 7 kun, undan oldingi 7 kun bilan taqqoslab)
  const monday = new Date(tashkentDayStart(now) + 5 * HOUR).getUTCDay() === 1;
  const weekly = monday ? renderStats(await collectAdminStats("7d"), "📅 <b>Haftalik hisobot — o'tgan 7 kun</b>", { prev: await collectAdminStats("7d", prevRange("7d")) }) : null;
  let sent = 0;
  for (const a of admins) {
    if (!a.telegramChatId) continue;
    const ok = await sendTelegram(a.telegramChatId, text, { keyboard: [[{ text: "📊 Bugun", data: "adm:stat:today" }, { text: "📥 Navbat", data: "adm:queue" }], [panelButton()]] });
    if (ok) sent++;
    if (weekly) await sendTelegram(a.telegramChatId, weekly, { keyboard: [[{ text: "30 kun", data: "adm:stat:30d" }, panelButton("/admin#analitika", "📈 Analitika")]] });
  }
  return { sent, skipped: false };
}

/* ------------------------------------------------------------------ */
/* Jonli ogohlantirishlar (adminga)                                    */
/* ------------------------------------------------------------------ */
/** Yangi mutaxassis profili (bot/ilova ro'yxati yoki saytda profil to'ldirilganda): saytda bildirishnoma + Telegramda «Tasdiqlash» tugmasi */
export async function notifyAdminsNewSpecialist(specialistId: string): Promise<void> {
  try {
    const sp = await db.query.specialists.findFirst({ where: eq(specialists.id, specialistId), columns: { id: true, slug: true, title: true, isVerified: true }, with: { user: { columns: { name: true, email: true } } } });
    if (!sp || sp.isVerified) return;
    const admins = await db.query.users.findMany({ where: and(eq(users.role, "admin"), eq(users.isBanned, false)), columns: { id: true, telegramChatId: true } });
    const text = `🎨 <b>Yangi mutaxassis:</b> ${escapeTelegramHtml(sp.user.name)} — ${escapeTelegramHtml(sp.title)}\n${escapeTelegramHtml(sp.user.email)}\nProfilni ko'rib, tasdiqlang.`;
    await Promise.all(
      admins.map(async (a) => {
        await notify(a.id, "account", `Yangi mutaxassis: ${sp.user.name}`, `${sp.title} — tasdiqlash navbatida.`, "/admin#tasdiqlash", { skipMail: true }).catch(() => undefined);
        if (a.telegramChatId) await sendTelegram(a.telegramChatId, text, { keyboard: [[{ text: "✅ Tasdiqlash", data: `adm:ver:${sp.id}` }, { text: "👁 Profil", url: `${site()}/mutaxassislar/${sp.slug}` }]] });
      }),
    );
  } catch (e) {
    console.error("[admin-bot:newSpecialist]", e);
  }
}

/** Kontakt sotildi — adminga daromad xabari (faqat Telegram, saytdagi ro'yxatni to'ldirmaydi) */
export async function notifyAdminsContactSold(buyerName: string, specialistName: string, amount: number): Promise<void> {
  try {
    const admins = await db.query.users.findMany({ where: and(eq(users.role, "admin"), eq(users.isBanned, false), isNotNull(users.telegramChatId)), columns: { telegramChatId: true } });
    const text = `💰 <b>Kontakt sotildi</b> — ${formatPrice(amount)}\n${escapeTelegramHtml(buyerName)} → ${escapeTelegramHtml(specialistName)}`;
    await Promise.all(admins.map((a) => (a.telegramChatId ? sendTelegram(a.telegramChatId, text, { keyboard: [[{ text: "📊 Statistika", data: "adm:stat:today" }, panelButton("/admin/kontaktlar", "Kontakt sotuvi")]] }) : Promise.resolve(false))));
  } catch (e) {
    console.error("[admin-bot:contactSold]", e);
  }
}

/* ------------------------------------------------------------------ */
/* /narx — kontakt narxlari (umumiy) va maxsus narx matni               */
/* ------------------------------------------------------------------ */
const LEVELS: Record<string, "contactPriceJunior" | "contactPriceMiddle" | "contactPriceSenior" | "contactPriceExpert"> = { junior: "contactPriceJunior", middle: "contactPriceMiddle", senior: "contactPriceSenior", expert: "contactPriceExpert", boshlangich: "contactPriceJunior", orta: "contactPriceMiddle", tajribali: "contactPriceSenior", ekspert: "contactPriceExpert" };

/** `/narx` — joriy kontakt narxlari; `/narx <daraja> <summa>` — o'zgartirish (junior|middle|senior|expert) */
export async function handleAdminPrices(chatId: string, args: string): Promise<void> {
  const { getSettings, saveSettings } = await import("@/lib/payments/settings");
  const admin = await adminByChat(chatId);
  if (!admin) return;
  const parts = args.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const current = await getSettings();
  const show = async (prefix = "") =>
    sendTelegram(
      chatId,
      `${prefix}💰 <b>Kontakt narxlari (daraja bo'yicha)</b>\n` +
        `• junior — ${formatPrice(current.contactPriceJunior)}\n• middle — ${formatPrice(current.contactPriceMiddle)}\n• senior — ${formatPrice(current.contactPriceSenior)}\n• expert — ${formatPrice(current.contactPriceExpert)}\n\n` +
        "O'zgartirish: <code>/narx middle 60000</code>. Maxsus narx — /user ism → «💰 Maxsus narx».",
      { keyboard: [[panelButton("/admin/kontaktlar", "Kontakt sotuvi (admin panel)")]] },
    );
  if (parts.length < 2) {
    await show();
    return;
  }
  const key = LEVELS[parts[0].replace(/['ʼ’]/g, "")];
  const amount = Number(parts[1].replace(/\D/g, ""));
  if (!key || !Number.isFinite(amount) || amount < 0 || amount > 50_000_000) {
    await sendTelegram(chatId, "Format: <code>/narx junior|middle|senior|expert 50000</code> (0 — bepul).");
    return;
  }
  const saved = await saveSettings({ [key]: Math.round(amount) });
  Object.assign(current, saved);
  await audit(admin.id, "admin_contact_settings", { targetType: "platform_settings", meta: { [key]: Math.round(amount), via: "telegram" } });
  await show("✅ Saqlandi.\n\n");
}

/** Maxsus narx oqimi: admin «💰 Maxsus narx» bosgach yozgan summa (bot_sessions flow="adminprice") */
export async function handleAdminPriceText(chatId: string, text: string): Promise<boolean> {
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
    await sendTelegram(chatId, "Summa 1 000 – 50 000 000 so'm oralig'ida bo'lsin (yoki <code>0</code> — umumiy narx). Qaytadan yozing:");
    return true;
  }
  await db.update(specialists).set({ contactPrice: amount, updatedAt: new Date() }).where(eq(specialists.id, s.data.specialistId));
  await audit(admin.id, "admin_contact_settings", { targetType: "specialist", targetId: s.data.specialistId, meta: { contactPrice: amount, via: "telegram" } });
  await clearBotSession(chatId);
  await sendTelegram(chatId, amount == null ? `✅ ${escapeTelegramHtml(s.data.name)} — maxsus narx olib tashlandi, umumiy narx amal qiladi.` : `✅ ${escapeTelegramHtml(s.data.name)} — kontakt narxi ${formatPrice(amount)}.`);
  return true;
}
