import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { audit } from "@/lib/security/audit";
import { enforceLimit } from "@/lib/security/rate-limit";
import { assertVacancyOwner, inviteCandidate, loadVacancy } from "@/lib/vacancies/service";
import { inviteSchema } from "@/lib/vacancies/validators";

type Ctx = { params: Promise<{ id: string }> };

/** POST: mos nomzodga taklif (sayt chati + bildirishnoma) — faqat vakansiya egasi, 30 / kun, bir nomzodga bir marta */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, inviteSchema);
  const v = await loadVacancy(id);
  if (!v) throw new ApiError(404, "Vakansiya topilmadi");
  assertVacancyOwner(v, { id: session.sub, role: session.role });
  await enforceLimit("vacancyInvite", session.sub);
  const res = await inviteCandidate(v, session.sub, input.userId, input.message);
  await audit(session.sub, "vacancy_invite", { targetType: "vacancy", targetId: v.id, meta: { userId: input.userId, score: res.score } }, req);
  return ok(res, { status: 201 });
});
