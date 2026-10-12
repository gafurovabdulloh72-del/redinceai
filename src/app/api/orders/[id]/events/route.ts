import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderEvents } from "@/lib/db/schema";
import { ApiError, handler, ok, requireSession } from "@/lib/api";
import { loadOrderWithParties } from "@/lib/payments/service";

export interface OrderEventDto {
  id: string;
  type: "status" | "amount" | "payment" | "dispute" | "note";
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  /** Kim: ism (tizim bo'lsa null) */
  actor: string | null;
  createdAt: number;
}

/**
 * Buyurtma tarixi (F36) — faqat tomonlar (mijoz, mutaxassis) va admin. Qo'shimcha: bekor sababi, nizo holati,
 * avtomatik qabul muddati (kabinetdagi karta uchun). Ism ko'rsatiladi, foydalanuvchi ID'lari chiqmaydi.
 */
export const GET = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const order = await loadOrderWithParties(id);
  if (!order) throw new ApiError(404, "Buyurtma topilmadi");
  const isParty = order.clientId === session.sub || order.specialist.userId === session.sub;
  if (!isParty && session.role !== "admin") throw new ApiError(404, "Buyurtma topilmadi");

  const rows = await db.query.orderEvents.findMany({
    where: eq(orderEvents.orderId, id),
    orderBy: [asc(orderEvents.createdAt)],
    limit: 200,
    with: { actor: { columns: { name: true } } },
  });
  const events: OrderEventDto[] = rows.map((e) => ({
    id: e.id,
    type: e.type,
    fromStatus: e.fromStatus,
    toStatus: e.toStatus,
    note: e.note,
    actor: e.actor?.name ?? null,
    createdAt: e.createdAt.getTime(),
  }));
  return ok({
    events,
    order: {
      cancelReason: order.cancelReason,
      disputeState: order.disputeState,
      disputeReason: order.disputeReason,
      disputeBy: order.disputeOpenedBy ? (order.disputeOpenedBy === order.clientId ? ("client" as const) : ("specialist" as const)) : null,
      autoReleaseAt: order.autoReleaseAt?.getTime() ?? null,
    },
  });
});
