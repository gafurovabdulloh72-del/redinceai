import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { enforceLimit } from "@/lib/security/rate-limit";
import { assertOwnUploads } from "@/app/api/orders/_lib/attachments";
import { startPurchase } from "@/lib/mentorship/purchases";
import { createWorkReview, listMyWorkReviews, workReviewCreateSchema } from "@/lib/mentorship/work-review";

/** GET — mening ish sharhi so'rovlarim (talaba sifatida) */
export const GET = handler(async () => {
  const session = await requireSession();
  return ok({ items: await listMyWorkReviews(session.sub) });
});

/**
 * POST — «Ishimni baholang» so'rovi: havola (faqat https) yoki o'z yuklamasi + izoh.
 * Narx 0 → bepul yo'l bilan darhol ustozga ketadi ({free:true}); aks holda {free:false, id} — klient xarid oynasini
 * (PurchaseDialog type="review", id) ochadi va to'lov mavjud oqim bilan o'tadi.
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  await enforceLimit("purchase", session.sub);
  const input = await parseBody(req, workReviewCreateSchema);
  if (input.workFile) await assertOwnUploads(session.sub, [input.workFile.url, ...(input.workFile.poster ? [input.workFile.poster] : [])], [], "workFile");
  const r = await createWorkReview(session.sub, input);
  if (r.price <= 0) {
    await startPurchase({ id: session.sub }, { type: "review", id: r.id, provider: "manual" });
    return ok({ id: r.id, free: true }, { status: 201 });
  }
  return ok({ id: r.id, free: false, price: r.price }, { status: 201 });
});
