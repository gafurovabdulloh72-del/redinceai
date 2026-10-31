import "server-only";
import { after } from "next/server";
import { and, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications, users } from "@/lib/db/schema";
import { brandedMail, sendMail } from "@/lib/security/mailer";
import { tryConsume } from "@/lib/security/rate-limit";
import { siteUrl } from "@/lib/security/site";
import { escapeTelegramHtml, isTelegramEnabled, sendTelegram } from "@/lib/telegram";
import { appUrl } from "@/lib/telegram-bot/app-url";
import { uid } from "@/lib/utils";

/**
 * Bildirishnoma turlari (UI'da ikonka/rang tanlash uchun). Matn har doim o'zbekcha.
 *  order_new        — mutaxassisga: yangi buyurtma keldi
 *  order_amount     — mijozga: narx belgilandi, to'lash mumkin
 *  order_paid       — mutaxassisga: mijoz to'ladi (eskrou)
 *  order_done       — mijozga: ish yakunlandi, qabul qiling
 *  order_released   — mutaxassisga: mijoz qabul qildi, pul balansga tushdi
 *  order_cancelled  — qarshi tomonga: bekor qilindi / rad etildi (sabab bilan)
 *  payment_pending  — adminga: qo'lda o'tkazma tasdiqlashni kutmoqda
 *  payment_refunded — mijozga: pul qaytarildi
 *  payment_cancelled — mijozga: «To'ladim» deb bildirilgan o'tkazma admin tomonidan tasdiqlanmadi
 *  payout           — mutaxassisga: pul chiqarish qarori
 *  payout_requested — adminga: yangi pul chiqarish so'rovi
 *  refund_needed    — adminga: bekor qilingan to'langan buyurtma / provayder qaytarish so'rovi
 *  dispute          — tomonlarga/adminga: nizo ochildi yoki hal qilindi
 *  report           — adminga: shikoyat keldi
 *  account          — foydalanuvchiga: hisob holati (bloklash, 2FA yoqildi/o'chirildi va h.k.)
 *  dispute_opened / dispute_resolved — nizo (eski "dispute" ham qo'llab-quvvatlanadi)
 *  proposal_new / proposal_accepted / proposal_declined / proposal_shortlisted — e'lon takliflari
 *  job_new / job_closed / job_expired / saved_search — e'lonlar va saqlangan qidiruvlar
 *  message_new      — buyurtma chatida yangi xabar (email: buyurtma bo'yicha 30 daqiqada ko'pi bilan 1 ta)
 *  order_due / order_sla — muddat eslatmalari
 *  review_new       — mutaxassisga: yangi sharh
 *  subscription_expiring / subscription_expired / subscription_paid / subscription_pending — obuna
 *  broadcast        — admin paneldan barcha (yoki rolga ko'ra) foydalanuvchilarga ommaviy e'lon/eslatma
 *  group_request / group_joined / post_comment / follow — jamoalar (qo'shilish so'rovi, tasdiq, izoh, yangi obunachi)
 *  post_like / mention — postga reaksiya (❤️🔥👏…; 24 soatda bir marta har bir odamdan) va @username eslatma (post yoki izohda)
 *  digest           — kunlik/haftalik jamlama (lib/digest.ts). Guruhga kirmaydi: uni o'chirish yo'li — users.digest_freq='off'
 */
export type NotificationType =
  | "order_new"
  | "order_amount"
  | "order_paid"
  | "order_done"
  | "order_released"
  | "order_cancelled"
  | "payment_pending"
  | "payment_refunded"
  | "payment_cancelled"
  | "payout"
  | "payout_requested"
  | "refund_needed"
  | "dispute"
  | "report"
  | "account"
  | "dispute_opened"
  | "dispute_resolved"
  | "proposal_new"
  | "proposal_accepted"
  | "proposal_declined"
  | "proposal_shortlisted"
  | "job_new"
  | "job_closed"
  | "job_expired"
  | "saved_search"
  | "message_new"
  | "chat"
  | "order_due"
  | "order_sla"
  | "review_new"
  | "subscription_expiring"
  | "subscription_expired"
  | "subscription_paid"
  | "subscription_pending"
  | "broadcast"
  | "group_request"
  | "channel_post"
  | "live_event"
  | "application_new"
  | "application_status"
  | "vacancy_expiring"
  | "profile_post"
  | "group_joined"
  | "post_comment"
  | "post_like"
  | "mention"
  | "follow"
  | "top_award"
  | "digest";

/** Email ham yuboriladigan muhim hodisalar (foydalanuvchi notifyEmail=true bo'lsa) */
const MAIL_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
  "order_new",
  "order_amount",
  "order_paid",
  "order_done",
  "order_released",
  "order_cancelled",
  "payment_refunded",
  "payment_cancelled",
  "payout",
  "dispute",
  "dispute_opened",
  "dispute_resolved",
  "account",
  "proposal_new",
  "proposal_accepted",
  "job_expired",
  "vacancy_expiring",
  "message_new",
  // Ichki chat (DM, #46): yangi xabar emaili — mavzu "Yangi xabar — {ism}", havola /kabinet/chat
  // (dm.ts sendDm shu sarlavha/havola bilan chaqiradi; qarshi tomonda o'qilmagan xabar bo'lsa yubormaydi)
  "chat",
  "subscription_expiring",
  "subscription_expired",
  "subscription_paid",
  // Jamlama: foydalanuvchi o'zi yoqqan (digest_freq) — email ham ketadi (notifyEmail=true bo'lsa)
  "digest",
]);

/** message_new / chat emaili: bitta buyurtma/suhbat bo'yicha 30 daqiqada ko'pi bilan bitta xat */
const MESSAGE_MAIL_WINDOW_MS = 30 * 60 * 1000;
/** O'chirilgan (anonimlashtirilgan) hisob manzili — hech qachon xat yuborilmaydi */
const DELETED_EMAIL_RE = /^deleted-.*@redince\.invalid$/i;

/** Havolani mutlaq URLga aylantirish: tashqi https:// bo'lsa o'zi, /yo'l bo'lsa sayt manzili qo'shiladi */
function absoluteHref(origin: string | null | undefined, href: string | null | undefined): string | null {
  if (!href) return null;
  if (href.startsWith("https://")) return href;
  return origin && href.startsWith("/") && !href.startsWith("//") ? `${origin}${href}` : null;
}

export interface NotifyOptions {
  /** message_new emaili/Telegram xabari uchun cheklov kaliti (odatda orderId). Berilmasa href ishlatiladi */
  mailKey?: string;
  /** Tashqi kanallarga yubormaslik (faqat saytdagi bildirishnoma — email ham, Telegram ham chiqmaydi) */
  skipMail?: boolean;
  /** MAIL_TYPES'da bo'lmagan tur uchun ham email yuborish (masalan, admin ommaviy e'loni "email bilan" rejimida) */
  forceMail?: boolean;
}

/** Email havolasi uchun sayt manzili: sozlamadagi kanonik manzil, dev'da — lokal server */
function mailOrigin(): string | null {
  const configured = siteUrl();
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return `http://localhost:${process.env.PORT || 3000}`;
  return null;
}

/**
 * Muhim hodisa uchun email (Resend sozlanmagan bo'lsa dev'da konsolga): sarlavha = bildirishnoma sarlavhasi,
 * matn + mutlaq havola. notifyEmail=false, o'chirilgan (deleted-*@redince.invalid) yoki bloklangan hisobga
 * yuborilmaydi (bloklash haqidagi "account" xabaridan tashqari).
 */
async function mailNotification(userId: string, type: NotificationType, title: string, body: string | null | undefined, href: string | null | undefined, opts: NotifyOptions): Promise<void> {
  const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { email: true, name: true, notifyEmail: true, isBanned: true } });
  if (!u || !u.notifyEmail || !u.email || DELETED_EMAIL_RE.test(u.email)) return;
  if (u.isBanned && type !== "account") return;
  if (type === "message_new" || type === "chat") {
    const key = opts.mailKey ?? href ?? "general";
    if (!(await tryConsume(`mailMsg:${userId}:${key}`.slice(0, 200), MESSAGE_MAIL_WINDOW_MS))) return;
  }
  const origin = mailOrigin();
  const link = absoluteHref(origin, href);
  const footer = "Email bildirishnomalarni Kabinet → Profil → «Email bildirishnomalar» orqali o'chirishingiz mumkin.";
  await sendMail(brandedMail({ to: u.email, title, name: u.name, body, link, footer }));
}

/**
 * Telegram xabari: foydalanuvchi hisobini botga ulagan bo'lsa (users.telegramChatId) bildirishnoma qisqa
 * ko'rinishda Telegramga ham boradi. Ulanganlikning o'zi rozilik — alohida opt-out yo'q (uzish: karta yoki /stop).
 * Email'dan farqli, barcha turlar yuboriladi (eslatmalar ham foydali); bloklangan hisobga faqat "account".
 * message_new / chat uchun email bilan bir xil 30 daqiqalik cheklov — alohida kalit (emailga xalal bermaydi).
 */
/** Telegram inline tugma yorlig'i — bildirishnoma turiga mos (foydalanuvchi nima ochilishini oldindan biladi) */
const TG_BUTTON_LABEL: Partial<Record<NotificationType, string>> = {
  message_new: "Xabarni ochish",
  chat: "Xabarni ochish",
  proposal_new: "Taklifni ko'rish",
  proposal_accepted: "Buyurtmani ochish",
  proposal_declined: "E'lonni ochish",
  proposal_shortlisted: "E'lonni ochish",
  job_new: "E'lonni ochish",
  job_closed: "E'lonni ochish",
  job_expired: "E'lonni uzaytirish",
  saved_search: "Natijalarni ko'rish",
  payout: "Balansni ochish",
  payout_requested: "So'rovni ko'rish",
  refund_needed: "To'lovni ko'rish",
  payment_pending: "To'lovni ko'rish",
  payment_refunded: "To'lovni ko'rish",
  payment_cancelled: "To'lovni ko'rish",
  dispute: "Nizoni ko'rish",
  dispute_opened: "Nizoni ko'rish",
  dispute_resolved: "Qarorni ko'rish",
  report: "Shikoyatni ko'rish",
  review_new: "Sharhni ko'rish",
  subscription_expiring: "Obunani uzaytirish",
  subscription_expired: "Obunani uzaytirish",
  subscription_paid: "Obunani ko'rish",
  subscription_pending: "Hisobni ko'rish",
  group_request: "So'rovni ko'rish",
  channel_post: "Postni ochish",
  live_event: "Efirga qo'shilish",
  application_new: "Arizani ko'rish",
  application_status: "Arizani ko'rish",
  broadcast: "Batafsil",
  account: "Kabinetni ochish",
  digest: "Kabinetni ochish",
};

async function telegramNotification(userId: string, type: NotificationType, title: string, body: string | null | undefined, href: string | null | undefined, opts: NotifyOptions): Promise<void> {
  if (!isTelegramEnabled()) return;
  const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { telegramChatId: true, isBanned: true } });
  if (!u?.telegramChatId) return;
  if (u.isBanned && type !== "account") return;
  if (type === "message_new" || type === "chat") {
    const key = opts.mailKey ?? href ?? "general";
    if (!(await tryConsume(`tgMsg:${userId}:${key}`.slice(0, 200), MESSAGE_MAIL_WINDOW_MS))) return;
  }
  const origin = mailOrigin();
  const link = absoluteHref(origin, href);
  const text = `<b>${escapeTelegramHtml(title)}</b>` + (body ? `\n${escapeTelegramHtml(body)}` : "");
  // Yangi buyurtma mutaxassisga: xabar ostida «Qabul qilish / Rad etish» tugmalari (botda bir bosishda)
  const orderId = type === "order_new" && link ? /\/buyurtma\/([\w-]+)/.exec(href ?? "")?.[1] : undefined;
  if (orderId) {
    const kb = await orderActionButtons(orderId, userId, link!);
    if (kb) return void (await sendTelegram(u.telegramChatId, text, { keyboard: kb }));
  }
  // Yalang'och URL o'rniga xabar ostida tugma — turga mos yorliq bilan (TG_BUTTON_LABEL; order_* — umumiy)
  const buttonText = href?.startsWith("https://") ? (type === "live_event" ? "Efirga qo'shilish" : "Havolani ochish") : (TG_BUTTON_LABEL[type] ?? (type.startsWith("order_") ? "Buyurtmani ochish" : "Saytda ochish"));
  await sendTelegram(u.telegramChatId, text, link ? { keyboard: [[telegramOpenButton(buttonText, href ?? null, link)]] } : {});
}

/**
 * Bildirishnoma tugmasi: ichki havola bo'lsa Mini App (Telegram ichida, avtomatik kirish — `lib/telegram-bot/ui.ts appUrl`),
 * tashqi https yoki Mini App mavjud bo'lmasa (dev, http) — oddiy URL.
 */
export function telegramOpenButton(text: string, href: string | null, link: string): { text: string; url?: string; webApp?: string } {
  if (href && href.startsWith("/") && !href.startsWith("//")) {
    const app = appUrl(href);
    if (app) return { text, webApp: app };
  }
  return { text, url: link };
}

/**
 * Yangi buyurtma bildirishnomasi mutaxassisga ketayotgan bo'lsa, botda tezkor tugmalar beramiz.
 * Faqat `new` holatidagi va AYNAN shu mutaxassisning buyurtmasi uchun (mijozga oddiy havola ketadi).
 */
async function orderActionButtons(orderId: string, recipientId: string, link: string) {
  try {
    const { orders, specialists } = await import("@/lib/db/schema");
    const row = await db
      .select({ status: orders.status, spUserId: specialists.userId })
      .from(orders)
      .innerJoin(specialists, eq(specialists.id, orders.specialistId))
      .where(eq(orders.id, orderId))
      .limit(1);
    if (row[0]?.status !== "new" || row[0]?.spUserId !== recipientId) return null;
    const { orderButtons } = await import("@/lib/telegram-bot/actions");
    return orderButtons(orderId, link);
  } catch {
    return null;
  }
}

/** Darhol ko'rinishi kerak bo'lgan turlar — push `urgency: high` bilan ketadi (telefon uyg'onadi) */
const PUSH_URGENT: ReadonlySet<NotificationType> = new Set<NotificationType>(["chat", "message_new", "live_event", "order_new", "order_paid", "dispute", "dispute_opened"]);

/**
 * Brauzer push bildirishnomasi (Web Push / VAPID). VAPID kalitlari sozlanmagan bo'lsa
 * yoki qurilma obunasi yo'q bo'lsa jim o'tadi. Bloklangan foydalanuvchiga faqat `account`.
 */
async function pushNotification(userId: string, type: NotificationType, title: string, body: string | null | undefined, href: string | null | undefined): Promise<void> {
  const { isPushEnabled } = await import("@/lib/push/web-push");
  if (!isPushEnabled()) return;
  const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { isBanned: true } });
  if (u?.isBanned && type !== "account") return;
  const { pushToUser } = await import("@/lib/push/service");
  await pushToUser(userId, { title, body, href: href ?? "/kabinet/bildirishnomalar", tag: type, urgency: PUSH_URGENT.has(type) ? "high" : "normal" });
}

/** Javobdan keyin bajarish (Next after()); so'rov kontekstidan tashqarida — oddiy fon promise */
function inBackground(task: () => Promise<void>): void {
  const run = () => task().catch((e) => console.error("[notify:mail]", e));
  try {
    after(run);
  } catch {
    void run();
  }
}

/**
 * Foydalanuvchiga bildirishnoma yozish. Hech qachon xato tashlamaydi —
 * buyurtma/to'lov oqimini bildirishnoma xatosi buzmasin. Muhim turlar uchun email fon rejimida
 * (javobni kutmasdan) yuboriladi.
 */
export async function notify(userId: string, type: NotificationType, title: string, body?: string | null, href?: string | null, opts: NotifyOptions = {}): Promise<void> {
  // Kabinet sozlamalari (users.notifyPrefs): guruh o'chirilgan bo'lsa — na saytda, na emailda, na Telegramda (xavfsizlik turlari bundan mustasno)
  if (!(await isNotifyAllowed(userId, type))) return;
  try {
    await db.insert(notifications).values({
      id: uid(),
      userId,
      type,
      title: title.slice(0, 160),
      body: body ? body.slice(0, 600) : null,
      href: href ?? null,
    });
  } catch (e) {
    console.error("[notify]", type, e);
  }
  if (opts.skipMail) return;
  const t = title.slice(0, 160);
  const b = body ? body.slice(0, 600) : body;
  try {
    // Email (faqat MAIL_TYPES) va Telegram parallel — biri yiqilsa ikkinchisi baribir yuboriladi
    inBackground(async () => {
      const results = await Promise.allSettled([
        MAIL_TYPES.has(type) || opts.forceMail ? mailNotification(userId, type, t, b, href, opts) : Promise.resolve(),
        telegramNotification(userId, type, t, b, href, opts),
        pushNotification(userId, type, t, b, href),
      ]);
      for (const r of results) if (r.status === "rejected") console.error("[notify:fanout]", type, r.reason);
    });
  } catch (e) {
    console.error("[notify:fanout]", type, e);
  }
}

/**
 * Barcha adminlarga bir xil bildirishnoma (qo'lda to'lov, qaytarish, payout so'rovi).
 * `dedupeMs` berilsa, shu muddat ichida bir xil (tur + sarlavha + matn) xabar bo'lsa qayta yozilmaydi —
 * provayder takroriy chaqiruvlari (masalan Payme CancelTransaction) adminni xabar bilan to'ldirmasin.
 */
export async function notifyAdmins(type: NotificationType, title: string, body?: string | null, href?: string | null, opts: { dedupeMs?: number } = {}): Promise<void> {
  try {
    if (opts.dedupeMs) {
      const dup = await db.query.notifications.findFirst({
        where: and(eq(notifications.type, type), eq(notifications.title, title.slice(0, 160)), gt(notifications.createdAt, new Date(Date.now() - opts.dedupeMs))),
        columns: { id: true },
      });
      if (dup) return;
    }
    const admins = await db.query.users.findMany({ where: eq(users.role, "admin"), columns: { id: true } });
    await Promise.all(admins.map((a) => notify(a.id, type, title, body, href)));
  } catch (e) {
    console.error("[notifyAdmins]", type, e);
  }
}

/** O'qilmaganlar birinchi, keyin yangilari — 20 ta */
export async function listNotifications(userId: string, limit = 20) {
  const [rows, [{ unread }]] = await Promise.all([
    db.query.notifications.findMany({
      where: eq(notifications.userId, userId),
      orderBy: [sql`case when ${notifications.readAt} is null then 0 else 1 end`, desc(notifications.createdAt)],
      limit,
    }),
    db
      .select({ unread: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
  ]);
  return { items: rows, unread: Number(unread) };
}

/** Belgilangan (yoki hammasini) o'qilgan deb belgilash — faqat o'z yozuvlari */
export async function markNotificationsRead(userId: string, ids?: string[]): Promise<number> {
  const where = ids && ids.length ? and(eq(notifications.userId, userId), isNull(notifications.readAt), inArray(notifications.id, ids)) : and(eq(notifications.userId, userId), isNull(notifications.readAt));
  const res = await db.update(notifications).set({ readAt: new Date() }).where(where);
  return res.rowsAffected;
}

/* ------------------------------------------------------------------ */
/* Bildirishnoma sozlamalari (kabinet): guruhlar va tozalash            */
/* ------------------------------------------------------------------ */

/**
 * Bildirishnoma guruhlari (Kabinet → Bildirishnomalar → Sozlamalar). Foydalanuvchi guruhni o'chirsa (users.notifyPrefs[key] = false)
 * shu turlar umuman yozilmaydi. ALWAYS_NOTIFY turlari (hisob xavfsizligi, nizo, to'lov holati) hech qachon o'chirilmaydi.
 */
export const NOTIFY_GROUPS = {
  orders: ["order_new", "order_amount", "order_paid", "order_done", "order_released", "order_cancelled", "order_due", "order_sla", "payment_pending", "payout", "payout_requested", "refund_needed", "review_new"],
  jobs: ["proposal_new", "proposal_accepted", "proposal_declined", "proposal_shortlisted", "job_new", "job_closed", "job_expired", "saved_search", "application_new", "application_status", "vacancy_expiring"],
  social: ["follow", "post_like", "post_comment", "mention", "profile_post", "channel_post", "live_event", "group_request", "group_joined"],
  chat: ["message_new", "chat"],
  system: ["broadcast", "subscription_expiring", "subscription_expired", "subscription_paid", "subscription_pending"],
} as const satisfies Record<string, readonly NotificationType[]>;
export type NotifyGroupKey = keyof typeof NOTIFY_GROUPS;
export const NOTIFY_GROUP_KEYS = Object.keys(NOTIFY_GROUPS) as NotifyGroupKey[];

/** Guruh yorliqlari va izohlari (UI) */
export const NOTIFY_GROUP_META: Record<NotifyGroupKey, { label: string; hint: string }> = {
  orders: { label: "Buyurtmalar", hint: "Yangi buyurtma, narx, to'lov, topshirish, sharh" },
  jobs: { label: "E'lonlar va vakansiyalar", hint: "Takliflar, arizalar, saqlangan qidiruvlar" },
  social: { label: "Ijtimoiy", hint: "Obunachilar, reaksiya, izoh, eslatma, kanal postlari, efir" },
  chat: { label: "Xabarlar", hint: "Chat va buyurtma chatidagi yangi xabarlar" },
  system: { label: "Tizim", hint: "Obuna holati, ma'muriyat e'lonlari" },
};

/** Hech qachon o'chirilmaydigan turlar: hisob xavfsizligi, nizo va qaytarishlar, shikoyat (adminga) */
const ALWAYS_NOTIFY: ReadonlySet<NotificationType> = new Set<NotificationType>(["account", "dispute", "dispute_opened", "dispute_resolved", "payment_refunded", "payment_cancelled", "report"]);

/** Tur qaysi guruhga kiradi (ALWAYS_NOTIFY yoki noma'lum tur — null) */
export function notifyGroupOf(type: string): NotifyGroupKey | null {
  for (const k of NOTIFY_GROUP_KEYS) if ((NOTIFY_GROUPS[k] as readonly string[]).includes(type)) return k;
  return null;
}

/** Sozlamalar bo'yicha ruxsat (yo'q kalit = yoqilgan). Xato bo'lsa — ruxsat (bildirishnoma yo'qolmasin) */
export async function isNotifyAllowed(userId: string, type: NotificationType): Promise<boolean> {
  if (ALWAYS_NOTIFY.has(type)) return true;
  const group = notifyGroupOf(type);
  if (!group) return true;
  try {
    const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { notifyPrefs: true } });
    return (u?.notifyPrefs ?? {})[group] !== false;
  } catch {
    return true;
  }
}

/** Eski o'qilgan bildirishnomalarni o'chirish (faqat o'ziniki); `days` kundan eski o'qilganlar. Qaytaradi: o'chirilganlar soni */
export async function purgeReadNotifications(userId: string, days = 30): Promise<number> {
  const before = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const res = await db.delete(notifications).where(and(eq(notifications.userId, userId), sql`${notifications.readAt} is not null`, sql`${notifications.createdAt} < ${before.getTime()}`));
  return res.rowsAffected;
}
