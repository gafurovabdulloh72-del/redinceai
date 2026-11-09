import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { enforceLimit } from "@/lib/security/rate-limit";
import { draftInputSchema, draftVacancy } from "@/lib/vacancies/assistant";

/**
 * POST: «Menga vakansiya yarat» — talab matnidan e'lon loyihasi (sarlavha, tavsif, talablar, ko'nikmalar, anketa, test).
 * Faqat kirgan foydalanuvchi, 20 / kun. Loyiha SAQLANMAYDI — formaga to'ldiriladi, ish beruvchi tahrirlab e'lon qiladi.
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  const input = await parseBody(req, draftInputSchema);
  await enforceLimit("vacancyAi", session.sub);
  return ok(await draftVacancy(input.brief, input.profession || undefined));
});
