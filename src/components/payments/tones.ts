import type { BadgeTone } from "@/components/ui";
import { ORDER_PAYMENT_STATE_LABEL, PAYMENT_PROVIDERS, PAYMENT_STATE_LABEL, PAYOUT_STATE_LABEL, type PaymentProvider } from "@/lib/constants";

export type OrderPaymentState = keyof typeof ORDER_PAYMENT_STATE_LABEL;
export type PaymentState = keyof typeof PAYMENT_STATE_LABEL;
export type PayoutState = keyof typeof PAYOUT_STATE_LABEL;

/** Semantik ohanglar: kutish — warning, eskrou — info, yakun — success, qaytarish — danger */
export const ORDER_PAYMENT_TONE: Record<OrderPaymentState, BadgeTone> = {
  none: "neutral",
  awaiting: "warning",
  paid: "info",
  released: "success",
  refunded: "neutral",
};

export const PAYMENT_TONE: Record<PaymentState, BadgeTone> = {
  created: "neutral",
  pending: "warning",
  paid: "info",
  released: "success",
  cancelled: "neutral",
  refunded: "danger",
};

export const PAYOUT_TONE: Record<PayoutState, BadgeTone> = {
  requested: "warning",
  approved: "info",
  paid: "success",
  rejected: "danger",
};

export const PROVIDER_LABEL: Record<PaymentProvider, string> = Object.fromEntries(PAYMENT_PROVIDERS.map((p) => [p.value, p.label])) as Record<PaymentProvider, string>;
export const PROVIDER_DESCRIPTION: Record<PaymentProvider, string> = Object.fromEntries(PAYMENT_PROVIDERS.map((p) => [p.value, p.description])) as Record<PaymentProvider, string>;

export const PAYOUT_METHOD_LABEL: Record<"card" | "bank" | "cash", string> = { card: "Karta", bank: "Bank hisobi", cash: "Naqd" };
