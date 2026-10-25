import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { enforceLimit } from "@/lib/security/rate-limit";
import { siteOrigin } from "@/lib/payments/config";
import { buildInvoiceRedirectUrl, loadInvoice, manualRequisites, markInvoiceSent } from "@/lib/subscriptions/billing";
import { isPurchase, purchaseMeta } from "@/lib/mentorship/purchases";
import { assertOwnUploads } from "@/app/api/orders/_lib/attachments";
import { IMAGE_URL_RE } from "@/components/chat/attachments";

type Ctx = { params: Promise<{ id: string }> };

async function own(id: string, session: { sub: string; role: string }) {
  const inv = await loadInvoice(id);
  if (!inv || !isPurchase(inv) || (inv.userId !== session.sub && session.role !== "admin")) throw new ApiError(404, "To'lov topilmadi");
  return inv;
}

/** GET — xarid holati (Payme/Click'dan qaytgach kuzatish) */
export const GET = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const inv = await own(id, session);
  const m = purchaseMeta(inv);
  return ok({
    id: inv.id,
    state: inv.state,
    provider: inv.provider,
    amount: inv.amount,
    title: m.title,
    type: m.type,
    itemId: m.itemId,
    redirectUrl: inv.state === "created" ? buildInvoiceRedirectUrl(inv, siteOrigin(req.headers, req.url)) : null,
    manual: inv.provider === "manual" && (inv.state === "created" || inv.state === "pending") ? await manualRequisites() : null,
    sent: inv.state === "pending" && inv.provider === "manual",
  });
});

/** PATCH {action:"sent", receiptUrl?} — o'tkazma qildim («To'ladim»): admin tasdiqlaydi */
export const PATCH = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  await enforceLimit("purchase", session.sub);
  const { id } = await ctx.params;
  const input = await parseBody(req, z.object({ action: z.literal("sent"), receiptUrl: z.string().max(500).nullish() }));
  const inv = await own(id, session);
  const receiptUrl = input.receiptUrl || null;
  if (receiptUrl) {
    if (!IMAGE_URL_RE.test(receiptUrl)) throw new ApiError(422, "Chek rasm bo'lishi kerak", { receiptUrl: "Rasm bo'lsin" });
    await assertOwnUploads(session.sub, [receiptUrl], [], "receiptUrl");
  }
  const row = await markInvoiceSent(inv, session.sub, req, receiptUrl);
  return ok({ state: row.state });
});
