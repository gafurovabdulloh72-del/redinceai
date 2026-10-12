import {
  Ban,
  Banknote,
  Bell,
  CheckCircle2,
  Clock3,
  Flag,
  Inbox,
  Scale,
  ShieldCheck,
  Undo2,
  UserRound,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";

/** Sahifadagi o'zgarishdan keyin qo'ng'iroq badge'ini yangilash uchun window hodisasi */
export const NOTIFICATIONS_CHANGED_EVENT = "redince:notifications-changed";
/** Qo'ng'iroq o'qilmaganlar sonini e'lon qiladi (detail: number) — kabinet navigatsiyasidagi badge shu bilan yangilanadi */
export const NOTIFICATIONS_UNREAD_EVENT = "redince:notifications-unread";

/** Bildirishnoma turi bo'yicha ikonka va ohang (qo'ng'iroq ro'yxati va /kabinet/bildirishnomalar uchun umumiy) */
export type NotificationTone = "accent" | "success" | "warning" | "danger" | "info" | "neutral";

const META: Record<string, { icon: LucideIcon; tone: NotificationTone; label: string }> = {
  order_new: { icon: Inbox, tone: "accent", label: "Buyurtma" },
  order_amount: { icon: Wallet, tone: "info", label: "Narx belgilandi" },
  order_paid: { icon: ShieldCheck, tone: "success", label: "To'lov eskrouda" },
  order_done: { icon: CheckCircle2, tone: "success", label: "Ish topshirildi" },
  order_released: { icon: Banknote, tone: "success", label: "Pul balansga tushdi" },
  order_cancelled: { icon: XCircle, tone: "danger", label: "Bekor qilindi" },
  payment_pending: { icon: Clock3, tone: "warning", label: "Tasdiq kutilmoqda" },
  payment_refunded: { icon: Undo2, tone: "info", label: "Pul qaytarildi" },
  payment_cancelled: { icon: Ban, tone: "danger", label: "To'lov tasdiqlanmadi" },
  payout: { icon: Banknote, tone: "success", label: "Pul chiqarish" },
  payout_requested: { icon: Wallet, tone: "warning", label: "Pul chiqarish so'rovi" },
  refund_needed: { icon: Undo2, tone: "warning", label: "Qaytarish kerak" },
  dispute: { icon: Scale, tone: "warning", label: "Nizo" },
  report: { icon: Flag, tone: "danger", label: "Shikoyat" },
  account: { icon: UserRound, tone: "neutral", label: "Hisob" },
};

const FALLBACK = { icon: Bell, tone: "neutral" as NotificationTone, label: "Bildirishnoma" };

export function notificationMeta(type: string) {
  return META[type] ?? FALLBACK;
}

/** Ohang → plitka klasslari (tokenlar orqali — ikkala temada to'g'ri) */
export const TONE_TILE: Record<NotificationTone, string> = {
  accent: "bg-accent-soft text-accent-text",
  success: "bg-success-soft text-success-text",
  warning: "bg-warning-soft text-warning-text",
  danger: "bg-danger-soft text-danger-text",
  info: "bg-info-soft text-info-text",
  neutral: "bg-fg/6 text-fg-2",
};
