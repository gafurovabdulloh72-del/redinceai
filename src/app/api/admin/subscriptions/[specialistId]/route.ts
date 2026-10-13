import { eq } from "drizzle-orm";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { specialists } from "@/lib/db/schema";
import { notify } from "@/lib/notifications";
import { audit } from "@/lib/security/audit";
import { rateLimit } from "@/lib/security/rate-limit";
import { adminExtend, cancelInvoice, invoiceHref, loadInvoice, markInvoicePaid, refundInvoice, toInvoiceView } from "@/lib/subscriptions/billing";
import { invoiceNumber } from "@/lib/subscriptions/labels";
import { adminSubscriptionActionSchema } from "@/lib/subscriptions/schemas";
import { formatPrice } from "@/lib/utils";

/**
 * Admin obuna amallari (hammasi audit jurnaliga — admin_subscription):
 *  extend  {days, note}       — muddatni qo'lda uzaytirish: max(now, joriy until) + days (pul harakati yo'q)
 *  confirm {invoiceId, note}  — qo'lda o'tkazmani tasdiqlash (created/pending → paid, muddat uzayadi)
 *  refund  {invoiceId, note}  — to'langan hisobni qaytarish (muddat shu davrga qisqaradi, now'dan pastga emas).
 *                               Pulning o'zi provayder kabinetidan / qo'lda qaytariladi.
 *  cancel  {invoiceId, note}  — to'lanmagan hisobni rad etish (o'tkazma topilmadi). Payme/Click'da jarayondagi — 409.
 * Hisob URL'dagi mutaxassisga tegishli bo'lishi shart (aks holda 404).
 */
export const PATCH = handler(async (req, ctx: { params: Promise<{ specialistId: string }> }) => {
  const session = await requireSession(["admin"]);
  const { specialistId } = await ctx.params;
  const input = await parseBody(req, adminSubscriptionActionSchema);
  await rateLimit(`adminSubscription:${session.sub}`, 120, 60 * 60 * 1000);

  const sp = await db.query.specialists.findFirst({ where: eq(specialists.id, specialistId), columns: { id: true, userId: true } });
  if (!sp) throw new ApiError(404, "Mutaxassis topilmadi");
  const note = input.note ? input.note : null;

  if (input.action === "extend") {
    const { until, previous } = await adminExtend(sp.id, input.days, { actorId: session.sub, note, req });
    return ok({ specialistId: sp.id, until: until.getTime(), previous: previous.getTime() });
  }

  const inv = await loadInvoice(input.invoiceId);
  if (!inv || inv.specialistId !== sp.id) throw new ApiError(404, "Obuna hisobi topilmadi");

  switch (input.action) {
    case "confirm": {
      if (inv.provider !== "manual") throw new ApiError(400, "Payme/Click hisoblari provayder orqali tasdiqlanadi");
      if (inv.state !== "pending" && inv.state !== "created") throw new ApiError(400, "Faqat kutilayotgan o'tkazmani tasdiqlash mumkin");
      const row = await markInvoicePaid(inv.id, { actorId: session.sub, req, providerTxnId: inv.providerTxnId ?? `manual-${inv.id}`, note });
      await audit(session.sub, "admin_subscription", { targetType: "subscription_invoice", targetId: inv.id, meta: { action: "confirm", amount: inv.amount, months: inv.months, note: note ?? undefined } }, req);
      return ok(toInvoiceView(row));
    }
    case "refund": {
      const row = await refundInvoice(inv.id, session.sub, { reason: 5, req, note });
      return ok(toInvoiceView(row));
    }
    case "cancel": {
      const row = await cancelInvoice(inv.id, { reason: 4 });
      await audit(session.sub, "admin_subscription", { targetType: "subscription_invoice", targetId: inv.id, meta: { action: "cancel", previousState: inv.state, note: note ?? undefined } }, req);
      // «To'ladim» deyilgan o'tkazma rad etildi — mutaxassis bilishi kerak
      if (inv.provider === "manual" && inv.state === "pending") {
        await notify(
          sp.userId,
          "payment_cancelled",
          "Obuna o'tkazmasi tasdiqlanmadi",
          `${invoiceNumber(inv.id)} — ${formatPrice(inv.amount)} o'tkazmasi administrator tomonidan topilmadi yoki rad etildi.${note ? ` Izoh: ${/[.!?]$/.test(note) ? note : `${note}.`}` : ""} Pul yuborgan bo'lsangiz qo'llab-quvvatlashga yozing.`,
          invoiceHref(inv.id),
        );
      }
      return ok(toInvoiceView(row));
    }
  }
});
