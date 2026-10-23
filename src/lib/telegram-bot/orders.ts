import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { ORDER_STATUS_LABEL } from "@/lib/constants";
import { notify } from "@/lib/notifications";
import { loadOrderWithParties, onOrderCancelled, orderHref, recordOrderEvent } from "@/lib/payments/service";
import { audit } from "@/lib/security/audit";
import { postSystemMessage } from "@/app/api/orders/_lib/messages";

export const STATUS_LABEL = ORDER_STATUS_LABEL;

/**
 * Botdagi «Qabul qilish / Rad etish» — FAQAT `new` holatidagi buyurtma uchun
 * (saytdagi PATCH /api/orders/[id] bilan bir xil yozuvlar: audit, order_events, chat tizim xabari, bildirishnoma).
 *
 * `new` holatida to'lov hali boshlanmagan va nizo bo'lishi mumkin emas — shuning uchun
 * route'dagi provayder/qo'lda o'tkazma qulflari bu yerga tegishli emas. CAS: holat `new` bo'lsa o'zgaradi.
 */
export async function setOrderStatus(orderId: string, actorId: string, accept: boolean): Promise<string> {
  const order = await loadOrderWithParties(orderId);
  if (!order) throw new ApiError(404, "Buyurtma topilmadi");
  if (order.specialist.userId !== actorId) throw new ApiError(403, "Bu buyurtma sizga tegishli emas");
  if (order.status !== "new") throw new ApiError(409, `Holat allaqachon «${ORDER_STATUS_LABEL[order.status]}»`);

  const status = accept ? "accepted" : "cancelled";
  const now = new Date();
  const changed = await db
    .update(orders)
    .set({ status, updatedAt: now, ...(accept ? {} : { cancelReason: "Telegram botda rad etildi", autoReleaseAt: null }) })
    .where(and(eq(orders.id, orderId), eq(orders.status, "new")))
    .returning({ id: orders.id });
  if (!changed.length) throw new ApiError(409, "Holat shu orada o'zgardi");

  await audit(actorId, "order_status", { targetType: "order", targetId: orderId, meta: { from: "new", to: status, via: "telegram" } }).catch(() => undefined);
  await recordOrderEvent(orderId, actorId, "status", { fromStatus: "new", toStatus: status, note: accept ? null : "Telegram botda rad etildi" }).catch(() => undefined);
  await postSystemMessage(orderId, `Holat: ${ORDER_STATUS_LABEL.new} → ${ORDER_STATUS_LABEL[status]}`).catch(() => undefined);

  const href = orderHref(orderId);
  const spName = order.specialist.user.name;
  if (accept) {
    await notify(order.clientId, "order_new", `${spName} buyurtmangizni qabul qildi`, `«${order.title}» — mutaxassis tez orada narx belgilaydi, keyin to'lovni eskrou orqali amalga oshirasiz.`, href);
    return "✅ Qabul qilindi — mijozga xabar ketdi. Narxni saytda belgilaysiz.";
  }
  await onOrderCancelled(order, actorId, "Telegram botda rad etildi").catch(() => undefined);
  await notify(order.clientId, "order_cancelled", `${spName} buyurtmani rad etdi`, `«${order.title}».`, href);
  return "✖️ Rad etildi — mijozga xabar ketdi.";
}
