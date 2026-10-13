import { eq } from "drizzle-orm";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { specialists } from "@/lib/db/schema";
import { siteOrigin } from "@/lib/payments/config";
import { enforceLimit } from "@/lib/security/rate-limit";
import { buildInvoiceRedirectUrl, createInvoice, invoiceHref, manualRequisites } from "@/lib/subscriptions/billing";
import { subscriptionCheckoutSchema } from "@/lib/subscriptions/schemas";

/**
 * Obuna to'lovini boshlash (faqat mutaxassis): {months, provider} → hisob ('created', yoki ochig'i qayta ishlatiladi)
 * + Payme/Click havolasi (qaytish: /kabinet/obuna?invoice=<id>) yoki o'tkazma rekvizitlari.
 */
export const POST = handler(async (req) => {
  const session = await requireSession(["specialist"]);
  const input = await parseBody(req, subscriptionCheckoutSchema);
  await enforceLimit("subscription", session.sub);

  const sp = await db.query.specialists.findFirst({ where: eq(specialists.userId, session.sub), columns: { id: true, userId: true } });
  if (!sp) throw new ApiError(404, "Avval mutaxassis profilini to'ldiring");

  const { invoice, reused } = await createInvoice(sp, input.months, input.provider, { actorId: session.sub, req });
  const redirectUrl = buildInvoiceRedirectUrl(invoice, siteOrigin(req.headers, req.url));
  if (invoice.provider !== "manual" && !redirectUrl) throw new ApiError(400, "To'lov havolasini tuzib bo'lmadi. Boshqa usulni tanlang");
  return ok(
    {
      invoiceId: invoice.id,
      provider: invoice.provider,
      months: invoice.months,
      amount: invoice.amount,
      state: invoice.state,
      reused,
      redirectUrl,
      manual: invoice.provider === "manual" ? manualRequisites() : null,
      statusPath: invoiceHref(invoice.id),
    },
    { status: reused ? 200 : 201 },
  );
});
