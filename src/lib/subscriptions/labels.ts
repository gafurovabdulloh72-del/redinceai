/**
 * Obuna UI yorliqlari va ohanglari — server ham, mijoz komponentlari ham import qila oladi
 * (server-only emas, bazaga tegmaydi). Qoida (holat hisoblash) — faqat subscriptions/access.ts'da.
 */
import type { BadgeTone } from "@/components/ui";

export type SubscriptionStatusKey = "trial" | "active" | "grace" | "expired" | "off" | "exempt";
export type InvoiceStateKey = "created" | "pending" | "paid" | "cancelled" | "refunded";
export type InvoiceProviderKey = "payme" | "click" | "manual";

export const SUB_STATUS_LABEL: Record<SubscriptionStatusKey, string> = {
  active: "Faol",
  trial: "Sinov muddati",
  grace: "Muhlat",
  expired: "Tugagan",
  off: "Talab qilinmaydi",
  exempt: "Imtiyozli",
};

export const SUB_STATUS_TONE: Record<SubscriptionStatusKey, BadgeTone> = {
  active: "success",
  trial: "info",
  grace: "warning",
  expired: "danger",
  off: "neutral",
  exempt: "blue",
};

export const INVOICE_STATE_LABEL: Record<InvoiceStateKey, string> = {
  created: "To'lanmagan",
  pending: "Tasdiq kutilmoqda",
  paid: "To'langan",
  cancelled: "Bekor qilingan",
  refunded: "Qaytarilgan",
};

export const INVOICE_STATE_TONE: Record<InvoiceStateKey, BadgeTone> = {
  created: "neutral",
  pending: "warning",
  paid: "success",
  cancelled: "neutral",
  refunded: "danger",
};

export const INVOICE_PROVIDER_LABEL: Record<InvoiceProviderKey, string> = { payme: "Payme", click: "Click", manual: "O'tkazma" };

/** "1 oy", "3 oy", "12 oy" */
export const monthsLabel = (m: number) => `${m} oy`;

/** Chek raqami: RS-XXXXXXXXXX (eskrou cheki RD-… dan farqli) */
export function invoiceNumber(id: string): string {
  return `RS-${id.replace(/^sub_/, "").replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}

/** Mijozga yuboriladigan obuna rejasi */
export interface PlanView {
  months: number;
  discountPct: number;
  /** Jami (so'm) */
  price: number;
  /** Oyiga ekvivalent (so'm) */
  monthly: number;
  /** Chegirmasiz narxga nisbatan tejash (so'm) */
  savings: number;
}

/** Mijozga yuboriladigan obuna hisobi */
export interface InvoiceView {
  id: string;
  number: string;
  months: number;
  amount: number;
  provider: InvoiceProviderKey;
  state: InvoiceStateKey;
  periodStart: number | null;
  periodEnd: number | null;
  paidAt: number | null;
  createdAt: number;
  /** Provayderga / adminga yetib borgan (Payme/Click tranzaksiyasi yoki «To'ladim») — bekor bo'lsa ham tarixda ko'rsatiladi */
  attempted: boolean;
}
