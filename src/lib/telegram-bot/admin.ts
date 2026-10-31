import "server-only";
import { and, desc, eq, gte, inArray, isNotNull, like, or, sql, type AnyColumn } from "drizzle-orm";
import { db } from "@/lib/db";
import { contactUnlocks, dmMessages, mentorPayouts, mentors, orders, payments, payouts, posts, reports, specialists, stories, subscriptionInvoices, users } from "@/lib/db/schema";
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

export function renderStats(s: AdminStats, title?: string): string {
  const q = s.queue;
  const queueTotal = q.pendingSpecialists + q.manualPayments + q.manualInvoices + q.reports + q.disputes + q.payouts + q.mentorPayouts + q.mentorApps;
  const head = title ?? `📊 <b>Statistika — ${PERIOD_LABEL[s.period]}</b> (${s.period === "today" ? fmtDate(s.to) : `${fmtDate(s.from)} – ${fmtDate(s.to)}`})`;
  return [
    head,
    "",
    `👥 <b>Foydalanuvchilar:</b> +${s.users.newTotal} (jami ${s.users.total}) · mutaxassis +${s.users.newSpecialists} · mijoz +${s.users.newClients}`,
    `🟢 Faol: ${s.users.active} · Telegram ulangan: ${s.users.telegram}`,
    `🎨 <b>Mutaxassislar:</b> ${s.specialists.listed} katalogda · ${s.specialists.verified} tasdiqlangan · ${s.specialists.pending} tasdiq kutmoqda`,
    `📦 <b>Buyurtmalar:</b> ${s.orders.created} yangi · ${s.orders.done} bajarildi · eskrou ${formatPrice(s.orders.escrowPaid)}`,
    `💰 <b>Tushum:</b> ${formatPrice(s.revenue.total)}`,
    `   obuna ${formatPrice(s.revenue.subscriptions)} · kontakt ${formatPrice(s.revenue.contacts)} (${s.revenue.contactsCount} ta) · mentorlik ${formatPrice(s.revenue.mentorship)} · komissiya ${formatPrice(s.orders.commission)}`,
    `📝 <b>Kontent:</b> ${s.content.posts} post · ${s.content.stories} story · ${s.content.dms} xabar`,
    "",
    `📥 <b>Navbat (${queueTotal}):</b> ${q.pendingSpecialists} tasdiq · ${q.manualPayments + q.manualInvoices} o'tkazma · ${q.reports} shikoyat · ${q.disputes} nizo · ${q.payouts + q.mentorPayouts} payout · ${q.mentorApps} mentor arizasi`,
  ].join("\n");
}

function statsKeyboard(period: StatPeriod): TelegramButton[][] {
  const periods = (["today", "7d", "30d"] as StatPeriod[]).map((p) => ({ text: p === period ? `• ${PERIOD_LABEL[p]} •` : PERIOD_LABEL[p], data: `adm:stat:${p}` }));
  return [periods, [{ text: "📥 Navbat", data: "adm:queue" }, { text: "💳 To'lovlar", data: "adm:pay" }], [panelButton()]];
}

/** /stat — statistika (msgId berilsa o'sha xabar tahrirlanadi) */
export async function sendAdminStats(chatId: string, period: StatPeriod = "today", msgId: number | null = null): Promise<void> {
  const s = await collectAdminStats(period);
  const text = renderStats(s);
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
    `🛠 <b>Admin menyu</b>\n${total > 0 ? `📥 Navbatda <b>${total}</b> ta ish bor.` : "📥 Navbat bo'sh ✅"}\n\n/stat — statistika · /navbat — tasdiq navbati · /tolovlar — o'tkazmalar · /user ism — foydalanuvchi · /elon — ommaviy e'lon`,
    {
      keyboard: [
        [{ text: "📊 Statistika", data: "adm:stat:today" }, { text: `📥 Navbat${total ? ` (${total})` : ""}`, data: "adm:queue" }],
        [{ text: "💳 To'lovlar", data: "adm:pay" }, { text: "📣 E'lon", data: "adm:elon" }],
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
  if (q.reports > 0) keyboard.push([panelButton("/admin#shikoyatlar", `🚩 Shikoyatlar (${q.reports})`)]);
  if (q.disputes > 0) keyboard.push([panelButton("/admin#nizolar", `⚖️ Nizolar (${q.disputes})`)]);
  if (q.payouts > 0) keyboard.push([panelButton("/admin#payoutlar", `💸 Payoutlar (${q.payouts})`)]);
  if (q.mentorPayouts > 0 || q.mentorApps > 0) keyboard.push([panelButton("/admin/mentorlik", `🎓 Mentorlik (${q.mentorPayouts + q.mentorApps})`)]);
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
  const s = await collectAdminStats("today", range);
  const text = renderStats(s, `🗓 <b>Kunlik hisobot — ${fmtDate(range.from)}</b>`);
  let sent = 0;
  for (const a of admins) {
    if (!a.telegramChatId) continue;
    const ok = await sendTelegram(a.telegramChatId, text, { keyboard: [[{ text: "📊 Bugun", data: "adm:stat:today" }, { text: "📥 Navbat", data: "adm:queue" }], [panelButton()]] });
    if (ok) sent++;
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
