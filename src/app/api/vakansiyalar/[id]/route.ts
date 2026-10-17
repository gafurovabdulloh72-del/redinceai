import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { optionalViewer } from "@/app/api/groups/_lib";
import { assertVacancyOwner, deleteVacancy, getVacancyView, loadVacancy, updateVacancy } from "@/lib/vacancies/service";
import { vacancyPatchSchema } from "@/lib/vacancies/validators";
import { audit } from "@/lib/security/audit";

type Ctx = { params: Promise<{ id: string }> };

async function vacancyOr404(id: string) {
  const v = await loadVacancy(id);
  if (!v) throw new ApiError(404, "Vakansiya topilmadi");
  return v;
}

/** GET: vakansiya (ko'ruvchiga mos: egasimi, arizasi bormi) */
export const GET = handler(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const view = await getVacancyView(id, await optionalViewer());
  if (!view) throw new ApiError(404, "Vakansiya topilmadi");
  return ok(view);
});

/** PATCH: tahrirlash / yopish / uzaytirish — egasi yoki admin */
export const PATCH = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const v = await vacancyOr404(id);
  const viewer = { id: session.sub, role: session.role };
  assertVacancyOwner(v, viewer);
  const patch = await parseBody(req, vacancyPatchSchema);
  const row = await updateVacancy(v, patch);
  await audit(session.sub, "vacancy_update", { targetType: "vacancy", targetId: v.id, meta: { fields: Object.keys(patch) } }, req);
  return ok(await getVacancyView(row.id, viewer));
});

/** DELETE: o'chirish — egasi yoki admin (arizalar kaskad bilan ketadi) */
export const DELETE = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const v = await vacancyOr404(id);
  assertVacancyOwner(v, { id: session.sub, role: session.role });
  await deleteVacancy(v.id);
  await audit(session.sub, "vacancy_delete", { targetType: "vacancy", targetId: v.id, meta: { title: v.title } }, req);
  return ok({ deleted: true });
});
