import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, payments } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { orderAmountSchema } from "@/lib/validators";
import { notify } from "@/lib/notifications";
import { findInFlightProviderPayment, loadOrderWithParties, orderHref, recordOrderEvent } from "@/lib/payments/service";
import { commissionPctFor, getSettings, splitAmount, urgentFeeFor } from "@/lib/payments/settings";
import { audit } from "@/lib/security/audit";
import { formatPrice } from "@/lib/utils";

/**
 * Mutaxassis narx belgilaydi (qabul qilingan / jarayondagi, yoki yakunlangan-u hali mijoz qabul qilmagan buyurtma):
 * amount → paymentState 'awaiting'. To'langan buyurtma narxi o'zgarmaydi.
 * Mijoz to'lovni boshlagan bo'lsa (provayderda jarayonda yoki «To'ladim» bosilgan o'tkazma) — 409.
 * Eski (hali provayderga yuborilmagan, 'created') urinishlar bekor qilinadi.
 * Komissiya foizi mutaxassis darajasiga qarab (yangi / oddiy / top, F21) shu paytda buyurtmaga snapshot qilinadi.
 * Shoshilinch buyurtmada (F30) `amount` — asosiy narx: urgentFee = urgentPct% ustama, orders.amount = asosiy + ustama
 * (mijoz to'laydigan jami; Payme/Click shu summani tekshiradi). Narx qayta belgilansa ochiq qarshi taklif (F16) yopiladi.
 */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const { amount } = await parseBody(req, orderAmountSchema);

  const order = await loadOrderWithParties(id);
  if (!order) throw new ApiError(404, "Buyurtma topilmadi");
  const isOwner = order.specialist.userId === session.sub;
  if (!isOwner && session.role !== "admin") throw new ApiError(403, "Narxni faqat mutaxassis belgilaydi");
  const priceable = order.status === "accepted" || order.status === "in_progress" || (order.status === "done" && !order.completedAt);
  if (!priceable) throw new ApiError(400, "Narx faqat qabul qilingan buyurtmaga belgilanadi");
  if (order.paymentState === "paid" || order.paymentState === "released") throw new ApiError(400, "To'langan buyurtma narxini o'zgartirib bo'lmaydi");
  if (await findInFlightProviderPayment(id)) throw new ApiError(409, "Mijoz to'lovni boshlagan — provayder tomonida jarayonda. Yakunlanishini yoki bekor bo'lishini kuting");
  const manualPending = await db.query.payments.findFirst({ where: and(eq(payments.orderId, id), eq(payments.provider, "manual"), eq(payments.state, "pending")), columns: { id: true } });
  if (manualPending) throw new ApiError(409, "Mijoz o'tkazma qilganini bildirgan — admin tasdiqlashini kuting");

  const settings = await getSettings();
  if (amount < settings.minOrderAmount) throw new ApiError(422, "Summa juda kichik", { amount: `Kamida ${formatPrice(settings.minOrderAmount)}` });

  const { pct, tier } = commissionPctFor(settings, order.specialist);
  const urgentFee = order.urgent ? urgentFeeFor(amount, settings.urgentPct) : null;
  const total = amount + (urgentFee ?? 0);
  const now = new Date();
  await db
    .update(orders)
    .set({ amount: total, urgentFee, paymentState: "awaiting", commissionPct: pct, counterAmount: null, counterBy: null, updatedAt: now })
    .where(eq(orders.id, id));
  // Eski summa bilan ochilgan, hali provayderga yuborilmagan urinishlar
  await db
    .update(payments)
    .set({ state: "cancelled", providerState: -1, cancelTime: now.getTime(), cancelReason: 4, updatedAt: now })
    .where(and(eq(payments.orderId, id), eq(payments.state, "created")));
  await audit(session.sub, "order_amount", { targetType: "order", targetId: id, meta: { from: order.amount ?? undefined, to: total, base: amount, urgentFee: urgentFee ?? undefined, commissionPct: pct, tier } }, req);

  const { commissionAmount, netAmount } = splitAmount(total, pct);
  const changed = order.amount != null && order.amount !== total;
  const feeNote = urgentFee ? ` + shoshilinch ustama ${formatPrice(urgentFee)} = ${formatPrice(total)}` : "";
  const counterNote = order.counterAmount != null ? ` Mijozning ${formatPrice(order.counterAmount)} taklifi o'rniga yangi narx.` : "";
  await recordOrderEvent(id, session.sub, "amount", { note: `${changed ? "Narx yangilandi" : "Narx belgilandi"}: ${formatPrice(amount)}${feeNote} (komissiya ${pct}%).${counterNote}` });
  await notify(
    order.clientId,
    "order_amount",
    changed ? `Narx yangilandi: ${formatPrice(total)}` : `Narx belgilandi: ${formatPrice(total)}`,
    `«${order.title}» — ${order.specialist.user.name} narxni belgiladi${urgentFee ? ` (asosiy ${formatPrice(amount)} + shoshilinch ustama ${formatPrice(urgentFee)})` : ""}. To'lov eskrouda saqlanadi va ish qabul qilingach mutaxassisga o'tadi.`,
    orderHref(order.id),
  );

  return ok({ id, amount: total, baseAmount: amount, urgentFee, paymentState: "awaiting", commissionPct: pct, tier, commissionAmount, netAmount, counterAmount: null, counterBy: null });
});
