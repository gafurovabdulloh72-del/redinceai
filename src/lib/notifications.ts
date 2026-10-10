import "server-only";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications, users } from "@/lib/db/schema";
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
  | "refund_needed";

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
}

/** Barcha adminlarga bir xil bildirishnoma (qo'lda to'lov, qaytarish, payout so'rovi) */
export async function notifyAdmins(type: NotificationType, title: string, body?: string | null, href?: string | null): Promise<void> {
  try {
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
