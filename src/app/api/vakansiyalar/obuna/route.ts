import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { checkVacancyAlerts, createVacancyAlert, deleteVacancyAlert, listVacancyAlerts, MAX_VACANCY_ALERTS } from "@/lib/vacancies/service";
import { vacancyAlertCreateSchema } from "@/lib/vacancies/validators";
import { rateLimit } from "@/lib/security/rate-limit";

/**
 * Saqlangan vakansiya qidiruvlari (vacancy_alerts) — faqat o'ziniki.
 * GET — ro'yxat; `?check=1` (faqat admin) — cron tekshiruvini qo'lda ishga tushirish (sinov uchun).
 */
export const GET = handler(async (req) => {
  const session = await requireSession();
  if (new URL(req.url).searchParams.get("check") === "1") {
    if (session.role !== "admin") throw new ApiError(403, "Faqat administrator");
    return ok(await checkVacancyAlerts());
  }
  return ok({ items: await listVacancyAlerts(session.sub), max: MAX_VACANCY_ALERTS });
});

/** POST: joriy /vakansiyalar filtrlarini nom bilan saqlash (kanonik querystring, takror saqlanmaydi) */
export const POST = handler(async (req) => {
  const session = await requireSession();
  const input = await parseBody(req, vacancyAlertCreateSchema);
  await rateLimit(`vacancyAlerts:${session.sub}`, 30, 60 * 60_000);
  return ok(await createVacancyAlert(session.sub, { name: input.name, query: input.query, notify: input.notify }), { status: 201 });
});

/** DELETE ?id=<alertId> — o'z qidiruvini o'chirish */
export const DELETE = handler(async (req) => {
  const session = await requireSession();
  const id = new URL(req.url).searchParams.get("id")?.trim() ?? "";
  if (!id) throw new ApiError(400, "id kerak");
  if (!(await deleteVacancyAlert(session.sub, id))) throw new ApiError(404, "Qidiruv topilmadi");
  return ok({ deleted: true });
});
