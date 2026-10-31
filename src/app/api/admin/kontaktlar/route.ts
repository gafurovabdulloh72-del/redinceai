import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { ApiError, handler, ok, parseBody, parseQuery, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { specialists } from "@/lib/db/schema";
import { audit } from "@/lib/security/audit";
import { notify } from "@/lib/notifications";
import { cancelInvoice, loadInvoice, markInvoicePaid, refundInvoice } from "@/lib/subscriptions/billing";
import { contactHref, contactMeta, contactPriceFor, isContactUnlock } from "@/lib/contacts/unlock";
import { getSettings } from "@/lib/payments/settings";
import { formatPrice } from "@/lib/utils";

/**
 * Admin — kontakt sotuvi:
 *  GET  ?userId=        — mutaxassisning kontakt rejimi/narxi (umumiy narx bilan)
 *  PATCH {specialistId, contactMode?, contactPrice?} — rejim (paid|hidden) va maxsus narx (null — umumiy)
 *  POST  {invoiceId, action: approve|reject|refund, note?} — qo'lda o'tkazma: tasdiqlash/rad etish, to'langanni qaytarish
 */
export const GET = handler(async (req) => {
  await requireSession(["admin"]);
  const { userId } = parseQuery(req.url, z.object({ userId: z.string().min(1).max(64) }));
  const sp = await db.query.specialists.findFirst({ where: eq(specialists.userId, userId), columns: { id: true, slug: true, experience: true, contactMode: true, contactPrice: true }, with: { user: { columns: { name: true } } } });
  if (!sp) throw new ApiError(404, "Bu foydalanuvchida mutaxassis profili yo'q");
  const settings = await getSettings();
  const [sold] = await db.select({ n: sql<number>`count(*)` }).from(sql`contact_unlocks`).where(sql`specialist_id = ${sp.id} and status = 'paid'`);
  return ok({ specialistId: sp.id, slug: sp.slug, name: sp.user.name, experience: sp.experience, contactMode: sp.contactMode, contactPrice: sp.contactPrice, effectivePrice: contactPriceFor(sp, settings), sold: Number(sold?.n ?? 0) });
});

export const PATCH = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const input = await parseBody(
    req,
    z.object({
      specialistId: z.string().min(1).max(64),
      contactMode: z.enum(["paid", "hidden"]).optional(),
      /** null — maxsus narx olib tashlanadi (daraja bo'yicha umumiy narx qaytadi) */
      contactPrice: z.number().int().min(0).max(100_000_000).nullable().optional(),
    }),
  );
  if (input.contactMode === undefined && input.contactPrice === undefined) throw new ApiError(400, "Hech narsa o'zgarmadi");
  const sp = await db.query.specialists.findFirst({ where: eq(specialists.id, input.specialistId), columns: { id: true, userId: true, contactMode: true, contactPrice: true } });
  if (!sp) throw new ApiError(404, "Mutaxassis topilmadi");
  await db
    .update(specialists)
    .set({ ...(input.contactMode !== undefined ? { contactMode: input.contactMode } : {}), ...(input.contactPrice !== undefined ? { contactPrice: input.contactPrice } : {}), updatedAt: new Date() })
    .where(eq(specialists.id, sp.id));
  await audit(session.sub, "admin_contact_settings", { targetType: "specialist", targetId: sp.id, meta: { from: { mode: sp.contactMode, price: sp.contactPrice }, to: { mode: input.contactMode ?? sp.contactMode, price: input.contactPrice === undefined ? sp.contactPrice : input.contactPrice } } }, req);
  return ok({ specialistId: sp.id, contactMode: input.contactMode ?? sp.contactMode, contactPrice: input.contactPrice === undefined ? sp.contactPrice : input.contactPrice });
});

export const POST = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const input = await parseBody(req, z.object({ invoiceId: z.string().min(1).max(80), action: z.enum(["approve", "reject", "refund"]), note: z.string().trim().max(200).optional() }));
  const inv = await loadInvoice(input.invoiceId);
  if (!inv || !isContactUnlock(inv)) throw new ApiError(404, "Hisob topilmadi");
  const note = input.note || null;
  if (input.action === "approve") {
    if (inv.provider !== "manual") throw new ApiError(400, "Payme/Click hisoblari provayder orqali tasdiqlanadi");
    if (inv.state !== "pending" && inv.state !== "created") throw new ApiError(400, "Faqat kutilayotgan o'tkazmani tasdiqlash mumkin");
    await markInvoicePaid(inv.id, { actorId: session.sub, req, providerTxnId: inv.providerTxnId ?? `manual-${inv.id}`, note: note ?? "kontakt o'tkazmasi" });
  } else if (input.action === "refund") {
    await refundInvoice(inv.id, session.sub, { reason: 5, req, note });
  } else {
    await cancelInvoice(inv.id, { force: true });
    if (inv.userId && inv.provider === "manual" && inv.state === "pending") {
      await notify(inv.userId, "payment_cancelled", "Kontakt o'tkazmasi tasdiqlanmadi", `${formatPrice(inv.amount)} o'tkazmasi administrator tomonidan topilmadi yoki rad etildi.${note ? ` Izoh: ${note}` : ""} Pul yuborgan bo'lsangiz qo'llab-quvvatlashga yozing.`, contactHref(inv.id)).catch(() => undefined);
    }
  }
  await audit(session.sub, "admin_subscription", { targetType: "subscription_invoice", targetId: inv.id, meta: { action: input.action, kind: "contact", amount: inv.amount, specialistId: contactMeta(inv).specialistId, note: note ?? undefined } }, req);
  return ok({ done: true });
});
