import { eq } from "drizzle-orm";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { specialists } from "@/lib/db/schema";
import { rateLimit } from "@/lib/security/rate-limit";
import { canViewInvoice, cancelInvoice, loadInvoice, markInvoiceSent, toInvoiceView } from "@/lib/subscriptions/billing";
import { invoiceActionSchema } from "@/lib/subscriptions/schemas";

type Ctx = { params: Promise<{ id: string }> };

async function ownInvoice(id: string, session: { sub: string; role: string }) {
  const sp = await db.query.specialists.findFirst({ where: eq(specialists.userId, session.sub), columns: { id: true } });
  const inv = await loadInvoice(id);
  // Begona yoki mavjud bo'lmagan hisob — bir xil 404 (id taxmin qilib bo'lmasin)
  if (!inv || !canViewInvoice(inv, { id: session.sub, role: session.role, specialistId: sp?.id ?? null })) throw new ApiError(404, "Obuna hisobi topilmadi");
  return inv;
}

/** Hisob holati (Payme/Click'dan qaytgach kuzatish uchun) — egasi yoki admin */
export const GET = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const inv = await ownInvoice(id, session);
  return ok(toInvoiceView(inv));
});

/**
 * Mutaxassis amallari:
 *  sent   — o'tkazma qildim («To'ladim»): created → pending, admin tasdiqlaydi
 *  cancel — hali yuborilmagan ('created') hisobni bekor qilish; jarayondagi (pending) — 409
 */
export const PATCH = handler(async (req, ctx: Ctx) => {
  // Admin ham sinov uchun o'z hisobida «To'ladim»/bekor qilishni bajara oladi
  const session = await requireSession(["specialist", "admin"]);
  const { id } = await ctx.params;
  const { action } = await parseBody(req, invoiceActionSchema);
  await rateLimit(`subscriptionInvoice:${session.sub}`, 30, 60 * 60 * 1000);
  const inv = await ownInvoice(id, session);

  if (action === "sent") {
    const row = await markInvoiceSent(inv, session.sub, req);
    return ok(toInvoiceView(row));
  }
  if (inv.state === "cancelled") return ok(toInvoiceView(inv));
  if (inv.state === "pending") {
    throw new ApiError(
      409,
      inv.provider === "manual"
        ? "O'tkazma tasdiqlash uchun yuborilgan — administrator uni ko'rib chiqadi"
        : "To'lov provayder (Payme/Click) tomonida jarayonda — uni faqat provayder yopadi yoki 12 soatdan keyin eskiradi",
    );
  }
  if (inv.state !== "created") throw new ApiError(400, "Bu hisobni bekor qilib bo'lmaydi");
  const row = await cancelInvoice(inv.id, { reason: 3 });
  return ok(toInvoiceView(row));
});
