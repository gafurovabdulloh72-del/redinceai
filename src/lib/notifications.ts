import "server-only";
import { and, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications, users } from "@/lib/db/schema";
import { sendMail } from "@/lib/security/mailer";
import { trustedSiteOrigin } from "@/lib/security/request";
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
 *  payout           — mutaxassisga: pul chiqarish qarori
 *  payout_requested — adminga: yangi pul chiqarish so'rovi
 *  refund_needed    — adminga: bekor qilingan to'langan buyurtma / provayder qaytarish so'rovi
 *  dispute          — tomonlarga/adminga: nizo ochildi yoki hal qilindi
 *  report           — adminga: shikoyat keldi
 *  account          — foydalanuvchiga: hisob holati (bloklash va h.k.)
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
  | "payout"
  | "payout_requested"
  | "refund_needed"
  | "dispute"
  | "report"
  | "account";

/** Email ham yuboriladigan muhim hodisalar (foydalanuvchi notifyEmail=true bo'lsa) */
const MAIL_TYPES: ReadonlySet<NotificationType> = new Set(["order_amount", "order_paid", "order_done", "order_released", "order_cancelled", "payment_refunded", "payout", "dispute", "account"]);

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

/**
 * Muhim hodisa uchun email (Resend sozlanmagan bo'lsa dev'da konsolga). Havola faqat ishonchli sayt manzili
 * (NEXT_PUBLIC_SITE_URL va h.k.) ma'lum bo'lsa qo'shiladi. Xato bo'lsa jim — bildirishnoma oqimi buzilmaydi.
 */
async function mailNotification(userId: string, type: NotificationType, title: string, body: string | null | undefined, href: string | null | undefined): Promise<void> {
  if (!MAIL_TYPES.has(type)) return;
  const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { email: true, name: true, notifyEmail: true, isBanned: true } });
  if (!u || !u.notifyEmail || !u.email) return;
  const origin = trustedSiteOrigin();
  const link = origin && href && href.startsWith("/") ? `${origin}${href}` : null;
  const text = [`Salom, ${u.name}!`, "", title, body ?? "", link ? `\nBatafsil: ${link}` : "", "", "— Redince. Bildirishnomalarni kabinet sozlamalarida o'chirishingiz mumkin."].join("\n");
  const html = `<!doctype html><html lang="uz"><body style="margin:0;background:#f6f4ee;font-family:Manrope,Segoe UI,Arial,sans-serif;color:#121213">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
  <p style="font-size:18px;font-weight:700;margin:0 0 20px">Redince<span style="color:#ff5a36">.</span></p>
  <div style="background:#fff;border:1px solid rgba(18,18,19,.08);border-radius:20px;padding:28px">
    <p style="font-size:20px;font-weight:700;margin:0 0 12px">${escapeHtml(title)}</p>
    <p style="margin:0 0 18px;line-height:1.55;color:#4b4a47">Salom, ${escapeHtml(u.name)}! ${escapeHtml(body ?? "")}</p>
    ${link ? `<p style="margin:0 0 20px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#121213;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">Batafsil</a></p>` : ""}
    <p style="margin:0;font-size:12px;line-height:1.5;color:#7d7b75">Bildirishnomalarni kabinet sozlamalarida o'chirishingiz mumkin.</p>
  </div>
</div></body></html>`;
  await sendMail({ to: u.email, subject: `Redince — ${title}`, html, text });
}

/**
 * Foydalanuvchiga bildirishnoma yozish. Hech qachon xato tashlamaydi —
 * buyurtma/to'lov oqimini bildirishnoma xatosi buzmasin.
 */
export async function notify(userId: string, type: NotificationType, title: string, body?: string | null, href?: string | null): Promise<void> {
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
  try {
    await mailNotification(userId, type, title.slice(0, 160), body, href);
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
