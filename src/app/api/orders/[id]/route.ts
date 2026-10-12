import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { orders, payments } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { orderStatusSchema } from "@/lib/validators";
import type { OrderStatus } from "@/lib/constants";
import { notify } from "@/lib/notifications";
import { AUTO_RELEASE_DAYS, autoReleaseDate, findInFlightProviderPayment, loadOrderWithParties, onOrderCancelled, orderHref, recordOrderEvent } from "@/lib/payments/service";
import { audit } from "@/lib/security/audit";
import { formatDate, formatPrice } from "@/lib/utils";

/**
 * Status o'zgarishi qoidalari:
 *  - mutaxassis: new -> accepted | cancelled; accepted -> in_progress | cancelled; in_progress -> done | cancelled
 *  - mijoz: new | accepted -> cancelled
 *  - admin: istalgan o'tish
 * Bekor qilishda ixtiyoriy `reason` — orders.cancelReason'da saqlanadi va kartada ko'rsatiladi (E68/F15).
 * To'langan buyurtma bekor qilinsa pul eskrouda qoladi — admin qaytaradi (bildirishnoma ketadi).
 * Har bir o'tish order_events jurnaliga yoziladi (F36). Nizo ochiq bo'lsa tomonlar holatni o'zgartira olmaydi.
 * To'langan buyurtma 'done' bo'lganda avtomatik qabul muddati (7 kun) belgilanadi (E57/F18).
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

const schema = orderStatusSchema.extend({ reason: z.string().trim().max(500).optional().or(z.literal("")) });

export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const { status, reason } = await parseBody(req, schema);

  const order = await loadOrderWithParties(id);
  if (!order) throw new ApiError(404, "Buyurtma topilmadi");

  const isSpecialist = order.specialist.userId === session.sub;
  const isClient = order.clientId === session.sub;
  const isAdmin = session.role === "admin";
  if (!isSpecialist && !isClient && !isAdmin) throw new ApiError(403, "Ruxsat yo'q");

  if (!isAdmin) {
    const allowed = (isSpecialist ? SPECIALIST_TRANSITIONS : CLIENT_TRANSITIONS)[order.status];
    if (!allowed.includes(status)) throw new ApiError(400, "Bu holatga o'tkazib bo'lmaydi");
  }
  if (status === order.status) return ok({ id, status, paymentState: order.paymentState });
  if (order.disputeState === "open" && !isAdmin) throw new ApiError(409, "Bu buyurtma bo'yicha nizo ochiq — admin qarorini kuting");

  // Payme/Click tomonida jarayondagi to'lov bo'lsa — buyurtmani bekor qilib bo'lmaydi (provayder tranzaksiyasi ichkaridan yopilmaydi)
  if (status === "cancelled" && (await findInFlightProviderPayment(id))) {
    throw new ApiError(409, "Mijoz to'lovni boshlagan — provayder tomonida jarayonda. Yakunlanishini yoki bekor bo'lishini kuting");
  }
  // «To'ladim» bosilgan qo'lda o'tkazma: pul yo'lda bo'lishi mumkin — avval admin tasdiqlaydi/rad etadi (aks holda yozuv yo'qoladi)
  if (status === "cancelled" && !isAdmin) {
    const manualPending = await db.query.payments.findFirst({ where: and(eq(payments.orderId, id), eq(payments.provider, "manual"), eq(payments.state, "pending")), columns: { id: true } });
    if (manualPending) throw new ApiError(409, "Mijoz o'tkazma qilganini bildirgan — avval administrator uni tasdiqlashi yoki rad etishi kerak");
  }

  const now = new Date();
  const cleanReason = reason?.trim() || null;
  // To'langan ish topshirildi — mijoz 7 kun ichida javob bermasa eskrou avtomatik o'tadi
  const autoRelease = status === "done" && order.paymentState === "paid" ? autoReleaseDate(now.getTime()) : null;
  await db
    .update(orders)
    .set({
      status,
      updatedAt: now,
      ...(status === "cancelled" ? { cancelReason: cleanReason, autoReleaseAt: null } : {}),
      ...(autoRelease ? { autoReleaseAt: autoRelease } : {}),
    })
    .where(eq(orders.id, id));
  await audit(session.sub, "order_status", { targetType: "order", targetId: id, meta: { from: order.status, to: status, reason: cleanReason ?? undefined } }, req);
  await recordOrderEvent(id, session.sub, "status", {
    fromStatus: order.status,
    toStatus: status,
    note: status === "cancelled" ? (cleanReason ? `Sabab: ${cleanReason}` : null) : autoRelease ? `Avtomatik qabul: ${formatDate(autoRelease)}` : null,
  });

  const href = orderHref(order.id);
  const spName = order.specialist.user.name;
  const why = cleanReason ? ` Sabab: ${cleanReason}` : "";

  switch (status) {
    case "accepted":
      await notify(order.clientId, "order_new", `${spName} buyurtmangizni qabul qildi`, `«${order.title}» — mutaxassis tez orada narx belgilaydi, keyin to'lovni eskrou orqali amalga oshirasiz.`, href);
      break;
    case "in_progress":
      await notify(order.clientId, "order_new", "Ish boshlandi", `«${order.title}» — ${spName} ishni boshladi.`, href);
      break;
    case "done":
      await notify(
        order.clientId,
        "order_done",
        "Ish yakunlandi — qabul qiling",
        order.paymentState === "paid"
          ? `«${order.title}» — natijani tekshiring va «Ishni qabul qilish»ni bosing. Shunda ${formatPrice(order.amount ?? 0)} mutaxassisga o'tadi. Javob bo'lmasa ${AUTO_RELEASE_DAYS} kundan keyin (${autoRelease ? formatDate(autoRelease) : ""}) avtomatik qabul qilinadi.`
          : `«${order.title}» — ${spName} ishni yakunladi. Natijani tasdiqlang.`,
        href,
      );
      break;
    case "cancelled": {
      await onOrderCancelled(order, session.sub, cleanReason);
      const byClient = isClient && !isSpecialist;
      if (byClient || isAdmin) {
        await notify(order.specialist.userId, "order_cancelled", order.status === "new" ? "Buyurtma bekor qilindi" : "Mijoz buyurtmani bekor qildi", `«${order.title}».${why}`, href);
      }
      if (isSpecialist || isAdmin) {
        await notify(
          order.clientId,
          "order_cancelled",
          order.status === "new" ? `${spName} buyurtmani rad etdi` : "Buyurtma bekor qilindi",
          `«${order.title}».${why}${order.paymentState === "paid" ? " To'lovingiz admin tomonidan qaytariladi." : ""}`,
          href,
        );
      }
      break;
    }
    default:
      break;
  }

  const fresh = await db.query.orders.findFirst({ where: eq(orders.id, id), columns: { paymentState: true } });
  return ok({ id, status, paymentState: fresh?.paymentState ?? order.paymentState, cancelReason: status === "cancelled" ? cleanReason : order.cancelReason, autoReleaseAt: autoRelease?.getTime() ?? (status === "cancelled" ? null : (order.autoReleaseAt?.getTime() ?? null)) });
});
