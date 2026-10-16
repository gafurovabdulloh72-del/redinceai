import { z } from "zod";
import { SUBSCRIPTION_PLANS } from "@/lib/constants";

/** Obuna API'lari uchun zod sxemalari (umumiy validators.ts'ga tegmaslik uchun shu yerda) */
const PLAN_MONTHS = SUBSCRIPTION_PLANS.map((p) => p.months) as number[];

export const subscriptionCheckoutSchema = z.object({
  months: z.coerce
    .number({ invalid_type_error: "Rejani tanlang" })
    .int("Rejani tanlang")
    .refine((m) => PLAN_MONTHS.includes(m), "1, 3, 6 yoki 12 oy tanlang"),
  provider: z.enum(["payme", "click", "manual"], { errorMap: () => ({ message: "To'lov usulini tanlang" }) }),
});

export const invoiceActionSchema = z.object({
  action: z.enum(["sent", "cancel"], { errorMap: () => ({ message: "Amal noto'g'ri" }) }),
  /** «To'ladim»da ixtiyoriy chek skrinshoti (/api/upload natijasi) — admin tasdiqlashni tezlashtiradi */
  receiptUrl: z.string().trim().max(500).optional().or(z.literal("")),
});

const note = z.string().trim().max(300, "Izoh 300 belgidan oshmasin").optional().or(z.literal(""));
const invoiceId = z.string().trim().min(5).max(80).startsWith("sub_", "Hisob raqami noto'g'ri");

export const adminSubscriptionActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("extend"),
    days: z.coerce.number({ invalid_type_error: "Kunlar sonini kiriting" }).int("Butun son kiriting").min(1, "Kamida 1 kun").max(730, "Ko'pi bilan 730 kun"),
    note,
  }),
  z.object({ action: z.literal("confirm"), invoiceId, note }),
  z.object({ action: z.literal("refund"), invoiceId, note }),
  z.object({ action: z.literal("cancel"), invoiceId, note }),
]);

export const ADMIN_SUB_FILTERS = ["all", "active", "trial", "grace", "expired"] as const;
export type AdminSubFilter = (typeof ADMIN_SUB_FILTERS)[number];

export const adminSubscriptionsQuerySchema = z.object({
  status: z.enum(ADMIN_SUB_FILTERS).optional().catch(undefined),
  q: z.string().trim().max(80).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
  invoices: z.enum(["all", "pending", "paid", "refunded", "cancelled"]).optional().catch(undefined),
});
