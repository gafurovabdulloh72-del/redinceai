import { ApiError, handler, ok, requireSession } from "@/lib/api";
import { assertVacancyOwner, loadVacancy, matchingCandidates } from "@/lib/vacancies/service";

type Ctx = { params: Promise<{ id: string }> };

/** GET: vakansiyaga eng mos ommaviy rezyumelar (hunting) — faqat egasi/admin; kontaktlarsiz */
export const GET = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const v = await loadVacancy(id);
  if (!v) throw new ApiError(404, "Vakansiya topilmadi");
  assertVacancyOwner(v, { id: session.sub, role: session.role });
  return ok({ items: await matchingCandidates(v) });
});
