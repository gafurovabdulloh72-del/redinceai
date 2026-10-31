import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { siteOrigin } from "@/lib/payments/config";
import { enforceLimit } from "@/lib/security/rate-limit";
import { audit } from "@/lib/security/audit";
import { buildInvoiceRedirectUrl, manualRequisites } from "@/lib/subscriptions/billing";
import { contactHref, startContactUnlock } from "@/lib/contacts/unlock";

const schema = z.object({ specialistId: z.string().min(1).max(64), provider: z.enum(["payme", "click", "manual"]) });

/**
 * POST — mutaxassis kontaktini ochish uchun to'lovni boshlash (platformaga).
 * Narx 0 bo'lsa darhol ochiladi ({free:true}); aks holda hisob + Payme/Click havolasi yoki o'tkazma rekvizitlari.
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  const input = await parseBody(req, schema);
  await enforceLimit("subscription", session.sub);
  const r = await startContactUnlock({ id: session.sub }, input.specialistId, input.provider);
  await audit(session.sub, "contact_unlock_started", { targetType: "specialist", targetId: input.specialistId, meta: { provider: input.provider, free: r.free } }, req);
  if (r.free) return ok({ free: true });
  const inv = r.invoice;
  const redirectUrl = buildInvoiceRedirectUrl(inv, siteOrigin(req.headers, req.url));
  if (inv.provider !== "manual" && !redirectUrl) throw new ApiError(400, "To'lov havolasini tuzib bo'lmadi. Boshqa usulni tanlang");
  return ok({ free: false, invoiceId: inv.id, amount: inv.amount, provider: inv.provider, redirectUrl, manual: inv.provider === "manual" ? await manualRequisites() : null, statusPath: contactHref(inv.id) }, { status: 201 });
});
