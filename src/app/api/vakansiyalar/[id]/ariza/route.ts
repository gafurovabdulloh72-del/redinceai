import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { applicantsCsv, applyToVacancy, assertVacancyOwner, listApplicants, loadVacancy } from "@/lib/vacancies/service";
import { applicationInputSchema } from "@/lib/vacancies/validators";
import { audit } from "@/lib/security/audit";
import { enforceLimit } from "@/lib/security/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET: nomzodlar ro'yxati — faqat vakansiya egasi (kontakt bilan: nomzod ariza berib rozilik bergan).
 * `?format=csv` — Excel uchun fayl (UTF-8 BOM, `;` ajratuvchi).
 */
export const GET = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const v = await loadVacancy(id);
  if (!v) throw new ApiError(404, "Vakansiya topilmadi");
  assertVacancyOwner(v, { id: session.sub, role: session.role });
  const items = await listApplicants(v.id);
  if (new URL(req.url).searchParams.get("format") === "csv") {
    await audit(session.sub, "applicants_export", { targetType: "vacancy", targetId: v.id, meta: { count: items.length } }, req);
    const name = `nomzodlar-${v.id.slice(0, 8)}.csv`;
    return new Response(applicantsCsv(items), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
    });
  }
  return ok({ items });
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
