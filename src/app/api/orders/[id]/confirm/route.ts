import { ApiError, handler, ok, requireSession } from "@/lib/api";
import { findInFlightProviderPayment, loadOrderWithParties, releaseOrder } from "@/lib/payments/service";
import { audit } from "@/lib/security/audit";

/**
 * Mijoz ishni qabul qiladi (buyurtma 'done' holatida): completedAt, eskroudagi pul mutaxassisga (released).
 * Idempotent: qayta chaqirilsa holat o'zgarmaydi. Pul qaytarilgan buyurtma qabul qilinmaydi;
 * provayderda jarayondagi to'lov bo'lsa — avval u yakunlansin (409).
 */
export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const order = await loadOrderWithParties(id);
  if (!order) throw new ApiError(404, "Buyurtma topilmadi");
  if (order.clientId !== session.sub && session.role !== "admin") throw new ApiError(403, "Ishni faqat buyurtmachi qabul qiladi");
  if (order.status !== "done") throw new ApiError(400, "Mutaxassis avval ishni yakunlashi kerak");
  if (order.paymentState === "refunded") throw new ApiError(400, "Pul qaytarilgan buyurtmani qabul qilib bo'lmaydi");
  if (order.disputeState === "open") throw new ApiError(409, "Bu buyurtma bo'yicha nizo ochiq — admin qarorini kuting");

  if (order.completedAt && order.paymentState !== "paid") {
    return ok({ id, paymentState: order.paymentState, completedAt: order.completedAt.getTime(), released: 0 });
  }
  if (await findInFlightProviderPayment(id)) throw new ApiError(409, "To'lov provayder tomonida jarayonda — yakunlanishini kuting, so'ng ishni qabul qiling");

  const { released } = await releaseOrder(id, session.sub, req);
  await audit(session.sub, "order_confirmed", { targetType: "order", targetId: id, meta: { released: released.reduce((s, p) => s + p.netAmount, 0) || undefined } }, req);
  const fresh = await loadOrderWithParties(id);
  return ok({
    id,
    paymentState: fresh?.paymentState ?? order.paymentState,
    completedAt: fresh?.completedAt?.getTime() ?? Date.now(),
    released: released.reduce((s, p) => s + p.netAmount, 0),
  });
});
