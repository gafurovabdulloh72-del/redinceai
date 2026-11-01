import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { enforceLimit } from "@/lib/security/rate-limit";
import { reorderLessons } from "@/lib/mentorship/service";

const schema = z.object({
  courseId: z.string().trim().min(5).max(80),
  /** Kursning BARCHA dars id'lari yangi tartibda */
  ids: z.array(z.string().trim().min(5).max(80)).min(1).max(200),
});

/** PUT — darslar tartibini surish (faqat kurs egasi yoki admin). Pozitsiyalar 1..n qayta yoziladi */
export const PUT = handler(async (req) => {
  const session = await requireSession();
  await enforceLimit("mentor", session.sub);
  const input = await parseBody(req, schema);
  await reorderLessons(session.sub, input.courseId, input.ids, session.role === "admin");
  return ok({ ok: true });
});
