import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { applyToVacancy, assertVacancyOwner, listApplicants, loadVacancy } from "@/lib/vacancies/service";
import { applicationInputSchema } from "@/lib/vacancies/validators";
import { audit } from "@/lib/security/audit";
import { enforceLimit } from "@/lib/security/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

/** GET: nomzodlar ro'yxati — faqat vakansiya egasi (kontakt bilan: nomzod ariza berib rozilik bergan) */
export const GET = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const v = await loadVacancy(id);
  if (!v) throw new ApiError(404, "Vakansiya topilmadi");
  assertVacancyOwner(v, { id: session.sub, role: session.role });
  return ok({ items: await listApplicants(v.id) });
});

/** POST: ariza yuborish — kirgan foydalanuvchi (rezyume yoki qisqa xat), 20 / kun */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, applicationInputSchema);
  const v = await loadVacancy(id);
  if (!v) throw new ApiError(404, "Vakansiya topilmadi");
  await enforceLimit("applications", session.sub);
  const a = await applyToVacancy(v, session.sub, input.coverLetter);
  await audit(session.sub, "application_create", { targetType: "vacancy", targetId: v.id, meta: { applicationId: a.id } }, req);
  return ok({ id: a.id, status: a.status }, { status: 201 });
});
