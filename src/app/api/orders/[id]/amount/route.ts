import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, payments } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { orderAmountSchema } from "@/lib/validators";
import { notify } from "@/lib/notifications";
import { findInFlightProviderPayment, loadOrderWithParties, orderHref } from "@/lib/payments/service";
import { getSettings, splitAmount } from "@/lib/payments/settings";
import { formatPrice } from "@/lib/utils";

/**
 * Mutaxassis narx belgilaydi (qabul qilingan / jarayondagi buyurtma): amount → paymentState 'awaiting'.
 * To'langan buyurtma narxi o'zgarmaydi. Eski (hali to'lanmagan) to'lov urinishlari bekor qilinadi.
 */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const { amount } = await parseBody(req, orderAmountSchema);

  const order = await loadOrderWithParties(id);
  if (!order) throw new ApiError(404, "Buyurtma topilmadi");
  const isOwner = order.specialist.userId === session.sub;
  if (!isOwner && session.role !== "admin") throw new ApiError(403, "Narxni faqat mutaxassis belgilaydi");
  if (order.status !== "accepted" && order.status !== "in_progress") throw new ApiError(400, "Narx faqat qabul qilingan buyurtmaga belgilanadi");
  if (order.paymentState === "paid" || order.paymentState === "released") throw new ApiError(400, "To'langan buyurtma narxini o'zgartirib bo'lmaydi");
  if (await findInFlightProviderPayment(id)) throw new ApiError(409, "Mijoz to'lovni boshlagan — provayder tomonida jarayonda. Yakunlanishini yoki bekor bo'lishini kuting");

  const settings = await getSettings();
  if (amount < settings.minOrderAmount) throw new ApiError(422, "Summa juda kichik", { amount: `Kamida ${formatPrice(settings.minOrderAmount)}` });

  const now = new Date();
  await db.update(orders).set({ amount, paymentState: "awaiting", commissionPct: settings.commissionPct, updatedAt: now }).where(eq(orders.id, id));
  // Eski summa bilan boshlangan, hali to'lanmagan urinishlar
  await db
    .update(payments)
    .set({ state: "cancelled", cancelTime: now.getTime(), cancelReason: 4, updatedAt: now })
    .where(and(eq(payments.orderId, id), inArray(payments.state, ["created", "pending"]), eq(payments.provider, "manual")));
  await db.update(payments).set({ state: "cancelled", cancelTime: now.getTime(), cancelReason: 4, updatedAt: now }).where(and(eq(payments.orderId, id), eq(payments.state, "created")));

  const { commissionAmount, netAmount } = splitAmount(amount, settings.commissionPct);
  const changed = order.amount != null && order.amount !== amount;
  await notify(
    order.clientId,
    "order_amount",
    changed ? `Narx yangilandi: ${formatPrice(amount)}` : `Narx belgilandi: ${formatPrice(amount)}`,
    `«${order.title}» — ${order.specialist.user.name} narxni belgiladi. To'lov eskrouda saqlanadi va ish qabul qilingach mutaxassisga o'tadi.`,
    orderHref(order.id),
  );

  return ok({ id, amount, paymentState: "awaiting", commissionPct: settings.commissionPct, commissionAmount, netAmount });
});
