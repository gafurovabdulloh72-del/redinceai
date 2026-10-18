import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { assertVacancyOwner, loadApplication, loadVacancy, setApplicationNote, setApplicationStatus, withdrawApplication } from "@/lib/vacancies/service";
import { applicationPatchSchema } from "@/lib/vacancies/validators";
import { audit } from "@/lib/security/audit";

type Ctx = { params: Promise<{ id: string }> };

async function load(id: string) {
  const app = await loadApplication(id);
  if (!app) throw new ApiError(404, "Ariza topilmadi");
  const v = await loadVacancy(app.vacancyId);
  if (!v) throw new ApiError(404, "Vakansiya topilmadi");
  return { app, v };
}

/**
 * PATCH: { status } — holat (ko'rildi / tanlovda / rad / ishga olindi; nomzodga bildirishnoma) va/yoki
 * { note } — ish beruvchining shaxsiy eslatmasi (nomzodga ko'rinmaydi). Faqat vakansiya egasi.
 */
export const PATCH = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const { status, note } = await parseBody(req, applicationPatchSchema);
  const { app, v } = await load(id);
  assertVacancyOwner(v, { id: session.sub, role: session.role });
  let row = app;
  if (note !== undefined) row = await setApplicationNote(row, note);
  if (status) {
    row = await setApplicationStatus(row, v, status);
    await audit(session.sub, "application_status", { targetType: "application", targetId: app.id, meta: { status } }, req);
  }
  return ok({ id: row.id, status: row.status, viewedAt: row.viewedAt?.getTime() ?? null, employerNote: row.employerNote });
});

/** DELETE: arizani qaytarib olish — nomzodning o'zi (yoki admin), faqat yangi/ko'rilgan holatda */
export const DELETE = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const { app } = await load(id);
  if (app.userId !== session.sub && session.role !== "admin") throw new ApiError(403, "Bu ariza sizniki emas");
  await withdrawApplication(app);
  await audit(session.sub, "application_withdraw", { targetType: "application", targetId: app.id }, req);
  return ok({ deleted: true });
});
