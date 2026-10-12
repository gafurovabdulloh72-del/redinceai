import { z } from "zod";
import { ApiError, handler, ok, parseQuery, requireSession } from "@/lib/api";
import { loadOrderWithParties } from "@/lib/payments/service";
import { commissionPctFor, getSettings, splitAmount } from "@/lib/payments/settings";

const schema = z.object({ amount: z.coerce.number().int().min(0).max(1_000_000_000).optional() });

/**
 * «Siz olasiz: X so'm (komissiya Y%)» jonli ko'rsatkich (F28). Foiz mutaxassis darajasiga qarab
 * (yangi / oddiy / top) — narx belgilash route'i bilan bir xil qoida. Faqat mutaxassis egasi yoki admin.
 */
export const GET = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const { amount } = parseQuery(req.url, schema);
  const order = await loadOrderWithParties(id);
  if (!order) throw new ApiError(404, "Buyurtma topilmadi");
  if (order.specialist.userId !== session.sub && session.role !== "admin") throw new ApiError(403, "Ruxsat yo'q");

  const settings = await getSettings();
  // To'langan buyurtma foizi o'zgarmaydi — snapshot; aks holda joriy daraja
  const locked = order.paymentState === "paid" || order.paymentState === "released";
  const { pct, tier } = locked && order.commissionPct != null ? { pct: order.commissionPct, tier: "standard" as const } : commissionPctFor(settings, order.specialist);
  const value = amount ?? order.amount ?? settings.minOrderAmount;
  const { commissionAmount, netAmount } = splitAmount(value, pct);
  return ok({ amount: value, commissionPct: pct, tier, commissionAmount, netAmount, minOrderAmount: settings.minOrderAmount });
});
