import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { siteOrigin } from "@/lib/payments/config";
import { enforceLimit } from "@/lib/security/rate-limit";
import { buildInvoiceRedirectUrl, manualRequisites } from "@/lib/subscriptions/billing";
import { purchaseHref, startPurchase } from "@/lib/mentorship/purchases";
import { purchaseStartSchema } from "@/lib/mentorship/purchase-schemas";

/**
 * POST — xaridni boshlash (kurs / efir chiptasi / oylik obuna / konsultatsiya).
 * Bepul (yoki 100% chegirma) bo'lsa — kirish darhol ochiladi ({free:true}); aks holda hisob + Payme/Click havolasi yoki o'tkazma rekvizitlari.
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  const input = await parseBody(req, purchaseStartSchema);
  await enforceLimit("subscription", session.sub);
  const r = await startPurchase({ id: session.sub }, input);
  if (r.free) return ok({ free: true });
  const inv = r.invoice;
  const redirectUrl = buildInvoiceRedirectUrl(inv, siteOrigin(req.headers, req.url));
  if (inv.provider !== "manual" && !redirectUrl) throw new ApiError(400, "To'lov havolasini tuzib bo'lmadi. Boshqa usulni tanlang");
  return ok({ free: false, invoiceId: inv.id, amount: inv.amount, provider: inv.provider, redirectUrl, manual: inv.provider === "manual" ? await manualRequisites() : null, statusPath: purchaseHref(inv.id) }, { status: 201 });
});
