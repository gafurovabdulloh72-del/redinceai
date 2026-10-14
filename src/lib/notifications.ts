import "server-only";
import { after } from "next/server";
import { and, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications, users } from "@/lib/db/schema";
import { brandedMail, sendMail } from "@/lib/security/mailer";
import { tryConsume } from "@/lib/security/rate-limit";
import { siteUrl } from "@/lib/security/site";
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
  | "subscription_pending";

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
  "message_new",
  "subscription_expiring",
  "subscription_expired",
  "subscription_paid",
]);

/** message_new emaili: bitta buyurtma bo'yicha 30 daqiqada ko'pi bilan bitta xat */
const MESSAGE_MAIL_WINDOW_MS = 30 * 60 * 1000;
/** O'chirilgan (anonimlashtirilgan) hisob manzili — hech qachon xat yuborilmaydi */
const DELETED_EMAIL_RE = /^deleted-.*@redince\.invalid$/i;

export interface NotifyOptions {
  /** message_new emaili uchun cheklov kaliti (odatda orderId). Berilmasa href ishlatiladi */
  mailKey?: string;
  /** Email yubormaslik (faqat saytdagi bildirishnoma) */
  skipMail?: boolean;
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
  if (type === "message_new") {
    const key = opts.mailKey ?? href ?? "general";
    if (!(await tryConsume(`mailMsg:${userId}:${key}`.slice(0, 200), MESSAGE_MAIL_WINDOW_MS))) return;
  }
  const origin = mailOrigin();
  const link = origin && href && href.startsWith("/") && !href.startsWith("//") ? `${origin}${href}` : null;
  const footer = "Email bildirishnomalarni Kabinet → Profil → «Email bildirishnomalar» orqali o'chirishingiz mumkin.";
  await sendMail(brandedMail({ to: u.email, title, name: u.name, body, link, footer }));
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
  if (opts.skipMail || !MAIL_TYPES.has(type)) return;
  try {
    inBackground(() => mailNotification(userId, type, title.slice(0, 160), body ? body.slice(0, 600) : body, href, opts));
  } catch (e) {
    console.error("[notify:mail]", type, e);
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
