import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { orders, payments } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { notify } from "@/lib/notifications";
import { findInFlightProviderPayment, orderHref, recordOrderEvent, type OrderWithParties } from "@/lib/payments/service";
import { commissionPctFor, getSettings, urgentFeeFor } from "@/lib/payments/settings";
import { enforceLimit } from "@/lib/security/rate-limit";
import { audit } from "@/lib/security/audit";
import { formatPrice } from "@/lib/utils";
import { loadOrderForParty } from "../../_lib/access";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("propose"), amount: z.coerce.number().int().min(1_000, "Kamida 1 000 so'm").max(1_000_000_000) }),
  z.object({ action: z.literal("accept") }),
  z.object({ action: z.literal("decline") }),
  z.object({ action: z.literal("withdraw") }),
]);

/** Narx muhokama qilinadigan holat: narx belgilangan, to'lov kutilmoqda, nizo yo'q, to'lov boshlanmagan */
async function assertNegotiable(order: OrderWithParties) {
  const open = order.status === "accepted" || order.status === "in_progress" || (order.status === "done" && !order.completedAt);
  if (!open || order.paymentState !== "awaiting" || order.amount == null) throw new ApiError(400, "Narxni faqat to'lov kutilayotgan buyurtmada muhokama qilish mumkin");
  if (order.disputeState === "open") throw new ApiError(409, "Bu buyurtma bo'yicha nizo ochiq — admin qarorini kuting");
  if (await findInFlightProviderPayment(order.id)) throw new ApiError(409, "To'lov provayder tomonida jarayonda — narxni o'zgartirib bo'lmaydi");
  const manualPending = await db.query.payments.findFirst({ where: and(eq(payments.orderId, order.id), eq(payments.provider, "manual"), eq(payments.state, "pending")), columns: { id: true } });
  if (manualPending) throw new ApiError(409, "O'tkazma yuborilgani bildirilgan — admin tasdiqlashini kuting");
}

/**
 * Narx bo'yicha qarshi taklif (F16). Summalar — ASOSIY narx (shoshilinch ustamasiz); qabul qilinganda
 * orders.amount = taklif + urgentFee (amount route bilan bir xil qoida).
 *  propose  — mijoz: mutaxassis belgilagan narx o'rniga o'z summasini taklif qiladi (counterBy = client)
 *  withdraw — mijoz: o'z taklifini qaytarib oladi
 *  accept   — mutaxassis: mijoz taklifini qabul qiladi → narx = taklif, komissiya qayta snapshot, eski checkout urinishlari bekor
 *  decline  — mutaxassis: rad etadi (joriy narx kuchda qoladi; yangi narxni «Narxni o'zgartirish» orqali belgilashi mumkin)
 * Har bir amal order_events jurnaliga yoziladi va qarshi tomonga bildirishnoma ketadi.
 */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, schema);
  await enforceLimit("messages", session.sub);
  const { order, role } = await loadOrderForParty(id, session, { write: true });
  await assertNegotiable(order);

  const settings = await getSettings();
  const href = orderHref(order.id);
  const base = (order.amount ?? 0) - (order.urgentFee ?? 0);
  const now = new Date();

  if (input.action === "propose") {
    if (role !== "client") throw new ApiError(403, "Narx taklifini faqat mijoz yuboradi");
    if (input.amount < settings.minOrderAmount) throw new ApiError(422, "Summa juda kichik", { amount: `Kamida ${formatPrice(settings.minOrderAmount)}` });
    if (input.amount === base) throw new ApiError(422, "Ma'lumotlarni tekshiring", { amount: "Taklif joriy narxdan farq qilishi kerak" });
    await db.update(orders).set({ counterAmount: input.amount, counterBy: "client", updatedAt: now }).where(eq(orders.id, id));
    await recordOrderEvent(id, session.sub, "amount", { note: `Mijoz narx taklif qildi: ${formatPrice(input.amount)} (mutaxassis narxi ${formatPrice(base)})` });
    await notify(
      order.specialist.userId,
      "order_amount",
      `Mijoz narx taklif qildi: ${formatPrice(input.amount)}`,
      `«${order.title}» — ${order.client.name} ${formatPrice(base)} o'rniga ${formatPrice(input.amount)} taklif qilmoqda. Qabul qiling yoki rad eting.`,
      href,
    );
    return ok({ id, amount: order.amount, urgentFee: order.urgentFee, counterAmount: input.amount, counterBy: "client" as const, commissionPct: order.commissionPct, paymentState: order.paymentState });
  }

  if (order.counterAmount == null || order.counterBy !== "client") throw new ApiError(400, "Ochiq narx taklifi yo'q");
  const counter = order.counterAmount;

  if (input.action === "withdraw") {
    if (role !== "client") throw new ApiError(403, "Taklifni faqat uni yuborgan mijoz qaytarib oladi");
    await db.update(orders).set({ counterAmount: null, counterBy: null, updatedAt: now }).where(eq(orders.id, id));
    await recordOrderEvent(id, session.sub, "amount", { note: `Mijoz ${formatPrice(counter)} taklifini qaytarib oldi` });
    return ok({ id, amount: order.amount, urgentFee: order.urgentFee, counterAmount: null, counterBy: null, commissionPct: order.commissionPct, paymentState: order.paymentState });
  }

  if (role !== "specialist") throw new ApiError(403, "Taklifga faqat mutaxassis javob beradi");

  if (input.action === "decline") {
    await db.update(orders).set({ counterAmount: null, counterBy: null, updatedAt: now }).where(eq(orders.id, id));
    await recordOrderEvent(id, session.sub, "amount", { note: `Mutaxassis ${formatPrice(counter)} taklifini rad etdi — narx ${formatPrice(order.amount ?? 0)} bo'lib qoldi` });
    await notify(
      order.clientId,
      "order_amount",
      "Narx taklifingiz rad etildi",
      `«${order.title}» — ${order.specialist.user.name} ${formatPrice(counter)} taklifini qabul qilmadi. Joriy narx: ${formatPrice(order.amount ?? 0)}.`,
      href,
    );
    return ok({ id, amount: order.amount, urgentFee: order.urgentFee, counterAmount: null, counterBy: null, commissionPct: order.commissionPct, paymentState: order.paymentState });
  }

  // accept
  const { pct, tier } = commissionPctFor(settings, order.specialist);
  const urgentFee = order.urgent ? urgentFeeFor(counter, settings.urgentPct) : null;
  const total = counter + (urgentFee ?? 0);
  await db.update(orders).set({ amount: total, urgentFee, commissionPct: pct, counterAmount: null, counterBy: null, updatedAt: now }).where(eq(orders.id, id));
  // Eski summa bilan ochilgan, hali provayderga yuborilmagan checkout urinishlari
  await db
    .update(payments)
    .set({ state: "cancelled", providerState: -1, cancelTime: now.getTime(), cancelReason: 4, updatedAt: now })
    .where(and(eq(payments.orderId, id), eq(payments.state, "created")));
  await audit(session.sub, "order_amount", { targetType: "order", targetId: id, meta: { from: order.amount ?? undefined, to: total, base: counter, urgentFee: urgentFee ?? undefined, commissionPct: pct, tier, counter: true } }, req);
  await recordOrderEvent(id, session.sub, "amount", { note: `Mutaxassis mijoz taklifini qabul qildi: ${formatPrice(counter)}${urgentFee ? ` + shoshilinch ustama ${formatPrice(urgentFee)} = ${formatPrice(total)}` : ""}` });
  await notify(order.clientId, "order_amount", `Taklifingiz qabul qilindi: ${formatPrice(total)}`, `«${order.title}» — ${order.specialist.user.name} narxga rozi bo'ldi. Endi eskrou orqali to'lashingiz mumkin.`, href);
  return ok({ id, amount: total, urgentFee, counterAmount: null, counterBy: null, commissionPct: pct, paymentState: order.paymentState });
});
