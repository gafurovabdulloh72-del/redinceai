import "server-only";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { uid } from "@/lib/utils";
import { clientIp } from "./request";

/** Ma'lum harakatlar va ularning o'zbekcha nomlari (admin jurnali uchun) */
export const AUDIT_ACTION_LABEL: Record<string, string> = {
  login_success: "Kirish",
  login_failed: "Kirish muvaffaqiyatsiz",
  register: "Ro'yxatdan o'tish",
  logout: "Chiqish",
  logout_all: "Barcha qurilmalardan chiqish",
  password_changed: "Parol o'zgartirildi",
  password_reset_requested: "Parol tiklash so'raldi",
  password_reset: "Parol tiklandi",
  login_blocked: "Kirish rad etildi (bloklangan)",
  email_verify_requested: "Email tasdiqlash kodi yuborildi",
  email_verified: "Email tasdiqlandi",
  account_export: "Ma'lumotlar eksporti",
  account_deleted: "Akkaunt o'chirildi",
  upload: "Fayl yuklandi",
  admin_verify: "Admin: profil tasdiqlandi",
  admin_unverify: "Admin: tasdiq olib tashlandi",
  admin_feature: "Admin: tavsiya etildi",
  admin_unfeature: "Admin: tavsiya olib tashlandi",
  admin_delete: "Admin: o'chirildi",
  admin_settings: "Admin: sozlamalar o'zgartirildi",
  admin_payout: "Admin: pul chiqarish qarori",
  admin_payment: "Admin: to'lov tasdiqlandi",
  payment_created: "To'lov boshlandi",
  payment_paid: "To'lov qabul qilindi",
  payment_released: "Pul mutaxassisga o'tkazildi",
  payment_refunded: "To'lov qaytarildi",
  payout_requested: "Pul chiqarish so'raldi",
  order_status: "Buyurtma holati o'zgardi",
  order_amount: "Narx belgilandi",
  order_confirmed: "Mijoz ishni qabul qildi",
  review_created: "Sharh qoldirildi",
  review_updated: "Sharh yangilandi",
  review_deleted: "Sharh o'chirildi",
};
export type AuditAction = keyof typeof AUDIT_ACTION_LABEL;

export function auditLabel(action: string) {
  return AUDIT_ACTION_LABEL[action] ?? action;
}

export interface AuditOptions {
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
}

/**
 * Audit yozuvi. Hech qachon xato tashlamaydi — asosiy oqimni buzmasin.
 * `req` berilsa IP saqlanadi.
 */
export async function audit(actorId: string | null, action: AuditAction | (string & {}), opts: AuditOptions = {}, req?: Request): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      id: uid(),
      actorId,
      action,
      targetType: opts.targetType ?? null,
      targetId: opts.targetId ?? null,
      ip: req ? clientIp(req) : null,
      meta: opts.meta ?? {},
    });
  } catch (e) {
    console.error("[audit]", action, e);
  }
}
