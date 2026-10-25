import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { enforceLimit } from "@/lib/security/rate-limit";
import { submissionReviewSchema } from "@/lib/mentorship/validators";
import { reviewSubmission } from "@/lib/mentorship/learning";

/** PATCH — vazifani baholash / qayta ishlashga qaytarish / «Talabalar ishi»ga qo'yish */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  await enforceLimit("mentor", session.sub);
  const { id } = await ctx.params;
  const input = await parseBody(req, submissionReviewSchema);
  await reviewSubmission(session.sub, session.role === "admin", id, input);
  return ok({ reviewed: true });
});
