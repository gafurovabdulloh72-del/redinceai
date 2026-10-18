import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { notify } from "@/lib/notifications";
import { audit } from "@/lib/security/audit";
import { deleteVacancy, loadVacancy, updateVacancy } from "@/lib/vacancies/service";

const schema = z.object({
  status: z.enum(["open", "closed"]),
  /** Yopishda egasiga yuboriladigan sabab (ixtiyoriy, 5–300 belgi) */
  reason: z.string().trim().min(5, "Kamida 5 belgi").max(300, "Ko'pi bilan 300 belgi").optional(),
});

/** Admin: vakansiyani yopish (moderatsiya) yoki qayta ochish — egasiga bildirishnoma, audit */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(["admin"]);
  const { id } = await ctx.params;
  const { status, reason } = await parseBody(req, schema);
  const v = await loadVacancy(id);
  if (!v) throw new ApiError(404, "Vakansiya topilmadi");
  if (v.status === status) return ok({ id, status });
  const saved = await updateVacancy(v, { status });
  await audit(session.sub, status === "closed" ? "admin_vacancy_closed" : "admin_vacancy_reopened", { targetType: "vacancy", targetId: id, meta: { title: v.title, reason } }, req);
  await notify(
    v.authorId,
    "account",
    status === "closed" ? "Vakansiyangiz moderatsiya tomonidan yopildi" : "Vakansiyangiz qayta ochildi",
    status === "closed" ? `«${v.title}»${reason ? `: ${reason}` : ""}. Tuzatib qayta joylashingiz mumkin.` : `«${v.title}» yana ro'yxatda ko'rinadi.`,
    `/vakansiyalar/${id}`,
  );
  return ok({ id, status: saved.status });
});

/** Admin: vakansiyani butunlay o'chirish (arizalar kaskad) */
export const DELETE = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(["admin"]);
  const { id } = await ctx.params;
  const v = await loadVacancy(id);
  if (!v) throw new ApiError(404, "Vakansiya topilmadi");
  await deleteVacancy(id);
  await audit(session.sub, "admin_vacancy_delete", { targetType: "vacancy", targetId: id, meta: { title: v.title, applications: v.applicationsCount } }, req);
  await notify(v.authorId, "account", "Vakansiyangiz o'chirildi", `«${v.title}» platforma qoidalariga ko'ra administratsiya tomonidan o'chirildi.`, "/vakansiyalar");
  return ok({ deleted: true });
});
