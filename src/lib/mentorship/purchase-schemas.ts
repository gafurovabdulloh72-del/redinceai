import { z } from "zod";

export const purchaseTypeSchema = z.enum(["course", "ticket", "sub", "consult"]);
export const purchaseQuoteSchema = z.object({
  type: purchaseTypeSchema,
  id: z.string().min(1).max(80),
  promo: z.string().trim().max(24).optional(),
  ref: z.string().trim().max(24).optional(),
  useCredit: z.boolean().optional(),
});
export const purchaseStartSchema = purchaseQuoteSchema.extend({ provider: z.enum(["payme", "click", "manual"]) });
