import { handler, ok, parseBody, parseQuery, requireSession } from "@/lib/api";
import { createVacancy, listVacancies } from "@/lib/vacancies/service";
import { vacancyFilterSchema, vacancyInputSchema } from "@/lib/vacancies/validators";
import { audit } from "@/lib/security/audit";
import { enforceLimit } from "@/lib/security/rate-limit";

/** GET: ochiq vakansiyalar (filtrlar) — ommaviy; POST: yangi vakansiya (har qanday kirgan foydalanuvchi, 5 / kun, to'lovsiz) */
export const GET = handler(async (req) => {
  const filter = parseQuery(req.url, vacancyFilterSchema);
  return ok(await listVacancies(filter));
});

export const POST = handler(async (req) => {
  const session = await requireSession();
  const input = await parseBody(req, vacancyInputSchema);
  await enforceLimit("vacancies", session.sub);
  const v = await createVacancy(session.sub, input);
  await audit(session.sub, "vacancy_create", { targetType: "vacancy", targetId: v.id, meta: { title: v.title, profession: v.profession } }, req);
  return ok({ id: v.id }, { status: 201 });
});
