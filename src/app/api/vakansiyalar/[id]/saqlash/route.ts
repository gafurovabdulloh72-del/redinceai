import { ApiError, handler, ok, requireSession } from "@/lib/api";
import { loadVacancy, toggleSaveVacancy } from "@/lib/vacancies/service";
import { enforceLimit } from "@/lib/security/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

/** POST: vakansiyani saqlash / saqlanganlardan olish (bookmark toggle) */
export const POST = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const v = await loadVacancy(id);
  if (!v) throw new ApiError(404, "Vakansiya topilmadi");
  await enforceLimit("social", session.sub);
  return ok(await toggleSaveVacancy(v.id, session.sub));
});
