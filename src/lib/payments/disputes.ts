import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, payments } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { notify, notifyAdmins } from "@/lib/notifications";
import { audit } from "@/lib/security/audit";
import { formatPrice } from "@/lib/utils";
import { loadOrderWithParties, orderHref, recordOrderEvent, refundPayment, releaseOrder, type OrderWithParties } from "./service";

/**
 * Nizo (E56/F19): mijoz yoki mutaxassis eskroudagi (paid) buyurtma bo'yicha nizo ochadi —
 * tasdiqlash va avtomatik release to'xtaydi, admin «release» yoki «refund» qarorini beradi.
 */
export const DISPUTE_RESOLUTIONS = ["release", "refund"] as const;
export type DisputeResolution = (typeof DISPUTE_RESOLUTIONS)[number];

/** Nizo ochish mumkinmi: jarayonda/yakunlangan + pul eskrouda + nizo yo'q */
export function canOpenDispute(order: Pick<OrderWithParties, "status" | "paymentState" | "disputeState">): boolean {
  return (order.status === "in_progress" || order.status === "done") && order.paymentState === "paid" && order.disputeState !== "open";
}

export async function openDispute(order: OrderWithParties, actorId: string, reason: string, req?: Request): Promise<void> {
  if (order.disputeState === "open") throw new ApiError(409, "Bu buyurtma bo'yicha nizo allaqachon ochilgan");
  if (!canOpenDispute(order)) throw new ApiError(400, "Nizo faqat pul eskrouda turgan (to'langan) jarayondagi yoki yakunlangan buyurtma bo'yicha ochiladi");
  const now = new Date();
  const [row] = await db
    .update(orders)
    .set({ disputeState: "open", disputeReason: reason, disputeOpenedBy: actorId, updatedAt: now })
    .where(and(eq(orders.id, order.id), eq(orders.disputeState, "none")))
    .returning({ id: orders.id });
  if (!row) {
    // Allaqachon ochilgan yoki hal qilingan (resolved → qayta ochilmaydi)
    const fresh = await db.query.orders.findFirst({ where: eq(orders.id, order.id), columns: { disputeState: true } });
    if (fresh?.disputeState === "open") throw new ApiError(409, "Bu buyurtma bo'yicha nizo allaqachon ochilgan");
    throw new ApiError(400, "Bu buyurtma bo'yicha nizo allaqachon hal qilingan");
  }

  const byClient = actorId === order.clientId;
  const who = byClient ? "Mijoz" : "Mutaxassis";
  await recordOrderEvent(order.id, actorId, "dispute", { note: `${who} nizo ochdi: ${reason}` });
  await audit(actorId, "dispute_opened", { targetType: "order", targetId: order.id, meta: { reason, by: byClient ? "client" : "specialist" } }, req);

  const other = byClient ? order.specialist.userId : order.clientId;
  await notify(other, "dispute", "Buyurtma bo'yicha nizo ochildi", `«${order.title}» — ${who.toLowerCase()} nizo ochdi: ${reason}. Admin ikkala tomonni ko'rib chiqib qaror qiladi; shu paytgacha pul eskrouda turadi.`, orderHref(order.id));
  await notifyAdmins("dispute", `Nizo: «${order.title}» (${formatPrice(order.amount ?? 0)})`, `${who} (${byClient ? order.client.name : order.specialist.user.name}) nizo ochdi: ${reason}`, "/admin#nizolar");
}

export async function resolveDispute(orderId: string, adminId: string, resolution: DisputeResolution, note: string | null, req?: Request): Promise<{ resolution: DisputeResolution }> {
  const order = await loadOrderWithParties(orderId);
  if (!order) throw new ApiError(404, "Buyurtma topilmadi");
  if (order.disputeState !== "open") throw new ApiError(400, "Bu buyurtma bo'yicha ochiq nizo yo'q");
  const now = new Date();

  if (resolution === "release") {
    await releaseOrder(orderId, adminId, req, { viaDispute: true });
  } else {
    const rows = await db.query.payments.findMany({ where: and(eq(payments.orderId, orderId), eq(payments.state, "paid")), columns: { id: true } });
    if (!rows.length) throw new ApiError(400, "Eskrouda to'lov topilmadi — qaytarish uchun hech narsa yo'q");
    for (const p of rows) await refundPayment(p.id, adminId, 5, req);
  }

  await db.update(orders).set({ disputeState: "resolved", updatedAt: now }).where(eq(orders.id, orderId));
  const verdict = resolution === "release" ? "pul mutaxassisga o'tkazildi" : "pul mijozga qaytarildi";
  await recordOrderEvent(orderId, adminId, "dispute", { note: `Admin nizoni hal qildi — ${verdict}${note ? `. Izoh: ${note}` : ""}` });
  await audit(adminId, "dispute_resolved", { targetType: "order", targetId: orderId, meta: { resolution, note: note || undefined } }, req);

  const body = `«${order.title}» — admin qarori: ${verdict}.${note ? ` Izoh: ${note}` : ""}`;
  await notify(order.clientId, "dispute", "Nizo hal qilindi", body, orderHref(orderId));
  await notify(order.specialist.userId, "dispute", "Nizo hal qilindi", body, orderHref(orderId));
  return { resolution };
}

/** Admin: ochiq nizolar (eng eskisi birinchi — navbat) */
export async function listOpenDisputes(limit = 50) {
  return db.query.orders.findMany({
    where: eq(orders.disputeState, "open"),
    orderBy: [desc(orders.updatedAt)],
    limit,
    with: {
      client: { columns: { id: true, name: true, email: true } },
      specialist: { columns: { id: true, slug: true, title: true, userId: true }, with: { user: { columns: { name: true, email: true } } } },
    },
  });
}
