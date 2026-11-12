import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { enforceLimit } from "@/lib/security/rate-limit";
import { assertOwnUploads } from "@/app/api/orders/_lib/attachments";
import { answerWorkReview, workReviewAnswerSchema } from "@/lib/mentorship/work-review";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST — ustoz sharhi: matn (≥20 belgi) + ixtiyoriy video (o'z yuklamasi). Begona → 404, talaba → 403.
 * Yuklama egaligi ruxsat tekshiruvidan KEYIN (begona so'rov borligini 422 orqali bilib olmasin).
 */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  await enforceLimit("mentor", session.sub);
  const { id } = await ctx.params;
  const input = await parseBody(req, workReviewAnswerSchema);
  await answerWorkReview(id, { id: session.sub, admin: session.role === "admin" }, input, async () => {
    if (input.responseVideo) await assertOwnUploads(session.sub, [input.responseVideo.url, ...(input.responseVideo.poster ? [input.responseVideo.poster] : [])], [], "responseVideo");
  });
  return ok({ ok: true });
});
