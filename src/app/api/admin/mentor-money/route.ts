import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { audit } from "@/lib/security/audit";
import { loadInvoice, markInvoicePaid, cancelInvoice } from "@/lib/subscriptions/billing";
import { isPurchase, resolvePayout } from "@/lib/mentorship/purchases";

/**
 * POST (admin):
 *  {kind:"payout", id, action:"paid"|"rejected", note?} — mentor yechish so'rovi (kartaga o'tkazilgach «paid»)
 *  {kind:"invoice", id, action:"approve"|"reject"} — qo'lda o'tkazma xaridini tasdiqlash/rad etish
 */
export const POST = handler(async (req) => {
  const session = await requireSession(["admin"]);
  const input = await parseBody(req, z.discriminatedUnion("kind", [z.object({ kind: z.literal("payout"), id: z.string(), action: z.enum(["paid", "rejected"]), note: z.string().max(200).optional() }), z.object({ kind: z.literal("invoice"), id: z.string(), action: z.enum(["approve", "reject"]) })]));
  if (input.kind === "payout") {
    await resolvePayout(input.id, input.action, input.note);
    await audit(session.sub, "admin_subscription", { targetType: "mentor_payout", targetId: input.id, meta: { action: input.action } }, req);
    return ok({ done: true });
  }
  const inv = await loadInvoice(input.id);
  if (!inv || !isPurchase(inv)) throw new ApiError(404, "Xarid topilmadi");
  if (input.action === "approve") await markInvoicePaid(inv.id, { actorId: session.sub, req, note: "mentorlik o'tkazmasi" });
  else await cancelInvoice(inv.id, { force: true });
  return ok({ done: true });
});
