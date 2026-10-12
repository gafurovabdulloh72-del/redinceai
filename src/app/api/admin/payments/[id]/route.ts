import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { audit } from "@/lib/security/audit";
import { notify } from "@/lib/notifications";
import { loadPaymentDetail } from "@/lib/payments/dto";
import { cancelPayment, findInFlightProviderPayment, markPaid, orderHref, refundPayment, releaseOrder } from "@/lib/payments/service";
import { formatPrice } from "@/lib/utils";

const schema = z.object({
  action: z.enum(["confirm", "release", "refund", "cancel"]),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});

/**
 * Admin to'lov amallari:
 *  confirm — qo'lda o'tkazma (pending/created) → paid (eskrou)
 *  release — paid → released (mutaxassis balansiga), buyurtma yakunlanadi
 *  refund  — paid → refunded (mijozga qaytarildi)
 *  cancel  — created/pending → cancelled (pul harakati bo'lmagan). Payme/Click tomonida JARAYONDAGI
 *            (pending, 12 soatdan eskirmagan) tranzaksiya ichkaridan yopilmaydi — uni faqat provayderning
 *            CancelTransaction/Complete(error) chaqiruvi yoki muddat o'tishi yopadi (aks holda keyingi
 *            PerformTransaction -31008 bilan qaytadi) → 409, mijoz/mutaxassis yo'llaridagi kabi.
 */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(["admin"]);
  const { id } = await ctx.params;
  const { action, note } = await parseBody(req, schema);
  const p = await loadPaymentDetail(id);
  if (!p) throw new ApiError(404, "To'lov topilmadi");

  switch (action) {
    case "confirm": {
      if (p.provider !== "manual") throw new ApiError(400, "Payme/Click to'lovlari provayder orqali tasdiqlanadi");
      if (p.state !== "pending" && p.state !== "created") throw new ApiError(400, "Faqat kutilayotgan o'tkazmani tasdiqlash mumkin");
      const row = await markPaid(p.id, { actorId: session.sub, req, providerTxnId: p.providerTxnId ?? `manual-${p.id.slice(0, 8)}` });
      await audit(session.sub, "admin_payment", { targetType: "payment", targetId: p.id, meta: { action, note: note || undefined } }, req);
      return ok({ id: row.id, state: row.state });
    }
    case "release": {
      if (p.state !== "paid") throw new ApiError(400, "Faqat eskroudagi to'lovni o'tkazish mumkin");
      await releaseOrder(p.orderId, session.sub, req);
      await audit(session.sub, "admin_payment", { targetType: "payment", targetId: p.id, meta: { action, note: note || undefined } }, req);
      return ok({ id: p.id, state: "released" });
    }
    case "refund": {
      const row = await refundPayment(p.id, session.sub, 5, req);
      await audit(session.sub, "admin_payment", { targetType: "payment", targetId: p.id, meta: { action, note: note || undefined } }, req);
      return ok({ id: row.id, state: row.state });
    }
    case "cancel": {
      if (p.provider !== "manual" && p.state === "pending" && (await findInFlightProviderPayment(p.orderId))?.id === p.id) {
        throw new ApiError(409, "To'lov provayder (Payme/Click) tomonida jarayonda — uni faqat provayder yopadi yoki 12 soatdan keyin eskiradi");
      }
      const row = await cancelPayment(p.id, 4, session.sub);
      await audit(session.sub, "admin_payment", { targetType: "payment", targetId: p.id, meta: { action, note: note || undefined } }, req);
      // Mijoz «To'ladim» degan o'tkazma rad etildi — u bilishi kerak (qayta to'lash yoki admin bilan bog'lanish)
      if (p.provider === "manual" && p.state === "pending") {
        await notify(
          p.clientId,
          "payment_cancelled",
          "O'tkazma tasdiqlanmadi",
          `«${p.order.title}» — ${formatPrice(p.amount)} o'tkazmasi administrator tomonidan topilmadi yoki rad etildi.${note ? ` Izoh: ${/[.!?]$/.test(note) ? note : `${note}.`}` : ""} Pul yuborgan bo'lsangiz qo'llab-quvvatlashga yozing.`,
          orderHref(p.orderId),
        );
      }
      return ok({ id: row.id, state: row.state });
    }
  }
});
