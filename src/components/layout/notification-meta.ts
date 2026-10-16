import {
  BadgeCheck,
  Ban,
  Banknote,
  Bell,
  BellRing,
  BookmarkCheck,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  Clock3,
  EyeOff,
  Flag,
  Inbox,
  ListChecks,
  Megaphone,
  MessageSquare,
  Scale,
  Send,
  ShieldCheck,
  Star,
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
  dispute_opened: { icon: Scale, tone: "warning", label: "Nizo" },
  dispute_resolved: { icon: Scale, tone: "warning", label: "Nizo" },
  proposal_new: { icon: Send, tone: "accent", label: "Yangi taklif" },
  proposal_accepted: { icon: CheckCircle2, tone: "success", label: "Taklif qabul qilindi" },
  proposal_declined: { icon: XCircle, tone: "neutral", label: "Taklif rad etildi" },
  proposal_shortlisted: { icon: ListChecks, tone: "info", label: "Saralandi" },
  job_new: { icon: BriefcaseBusiness, tone: "accent", label: "Yangi e'lon" },
  job_closed: { icon: BriefcaseBusiness, tone: "neutral", label: "E'lon yopildi" },
  job_expired: { icon: Clock3, tone: "neutral", label: "E'lon yopildi" },
  saved_search: { icon: BookmarkCheck, tone: "info", label: "Saqlangan qidiruv" },
  message_new: { icon: MessageSquare, tone: "info", label: "Yangi xabar" },
  order_due: { icon: CalendarClock, tone: "warning", label: "Muddat yaqin" },
  order_sla: { icon: BellRing, tone: "warning", label: "Javob kutilmoqda" },
  review_new: { icon: Star, tone: "accent", label: "Yangi sharh" },
  subscription_expiring: { icon: Clock3, tone: "warning", label: "Obuna tugayapti" },
  subscription_expired: { icon: EyeOff, tone: "danger", label: "Obuna tugadi" },
  subscription_paid: { icon: BadgeCheck, tone: "success", label: "Obuna faollashdi" },
  subscription_pending: { icon: Clock3, tone: "warning", label: "Obuna: tasdiq kutilmoqda" },
  broadcast: { icon: Megaphone, tone: "accent", label: "E'lon" },
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
