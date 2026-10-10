import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { orderStatusSchema } from "@/lib/validators";
import type { OrderStatus } from "@/lib/constants";

/**
 * Status o'zgarishi qoidalari:
 *  - mutaxassis: new -> accepted | cancelled; accepted -> in_progress | cancelled; in_progress -> done
 *  - mijoz: new | accepted -> cancelled
 */
const SPECIALIST_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ["accepted", "cancelled"],
  accepted: ["in_progress", "cancelled"],
  in_progress: ["done", "cancelled"],
  done: [],
  cancelled: [],
};
const CLIENT_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ["cancelled"],
  accepted: ["cancelled"],
  in_progress: [],
  done: [],
  cancelled: [],
};

export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const { status } = await parseBody(req, orderStatusSchema);

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: { specialist: { columns: { userId: true } } },
  });
  if (!order) throw new ApiError(404, "Buyurtma topilmadi");

  const isSpecialist = order.specialist.userId === session.sub;
  const isClient = order.clientId === session.sub;
  const isAdmin = session.role === "admin";
  if (!isSpecialist && !isClient && !isAdmin) throw new ApiError(403, "Ruxsat yo'q");

  if (!isAdmin) {
    const allowed = (isSpecialist ? SPECIALIST_TRANSITIONS : CLIENT_TRANSITIONS)[order.status];
    if (!allowed.includes(status)) throw new ApiError(400, "Bu holatga o'tkazib bo'lmaydi");
  }

  await db.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, id));
  return ok({ id, status });
});
