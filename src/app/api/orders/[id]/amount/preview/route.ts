import { z } from "zod";
import { ApiError, handler, ok, parseQuery, requireSession } from "@/lib/api";
import { loadOrderWithParties } from "@/lib/payments/service";
import { commissionPctFor, getSettings, splitAmount, urgentFeeFor } from "@/lib/payments/settings";

const schema = z.object({ amount: z.coerce.number().int().min(0).max(1_000_000_000).optional() });

/**
 * «Siz olasiz: X so'm (komissiya Y%)» jonli ko'rsatkich (F28). Foiz mutaxassis darajasiga qarab
 * (yangi / oddiy / top) — narx belgilash route'i bilan bir xil qoida. Faqat mutaxassis egasi yoki admin.
 * `amount` — asosiy narx; shoshilinch buyurtmada urgentFee qo'shiladi va komissiya jami summadan hisoblanadi (F30).
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
  const value = amount ?? (order.amount != null ? order.amount - (order.urgentFee ?? 0) : settings.minOrderAmount);
  const urgentFee = order.urgent ? urgentFeeFor(value, settings.urgentPct) : 0;
  const total = value + urgentFee;
  const { commissionAmount, netAmount } = splitAmount(total, pct);
  return ok({ amount: value, urgent: order.urgent, urgentPct: settings.urgentPct, urgentFee, total, commissionPct: pct, tier, commissionAmount, netAmount, minOrderAmount: settings.minOrderAmount });
});
