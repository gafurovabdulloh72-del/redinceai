import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { enforceLimit } from "@/lib/security/rate-limit";
import { updateWorkReviewSettings, workReviewSettingsSchema } from "@/lib/mentorship/work-review";

type Ctx = { params: Promise<{ id: string }> };

/** PUT — «Ishimni baholang» xizmati sozlamasi (ustozning o'zi yoki admin): yoqish, narx, tavsif, javob muddati */
export const PUT = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  await enforceLimit("mentor", session.sub);
  const { id } = await ctx.params;
  const input = await parseBody(req, workReviewSettingsSchema);
  await updateWorkReviewSettings(id, { id: session.sub, admin: session.role === "admin" }, input);
  return ok({ ok: true });
});
