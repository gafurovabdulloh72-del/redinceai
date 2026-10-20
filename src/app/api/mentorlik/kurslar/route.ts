import { z } from "zod";
import { handler, ok, parseBody, parseQuery, requireSession } from "@/lib/api";
import { courseSchema } from "@/lib/mentorship/validators";
import { createCourse, listCourses } from "@/lib/mentorship/service";

const querySchema = z.object({
  category: z.string().trim().max(32).optional(),
  level: z.string().trim().max(32).optional(),
  q: z.string().trim().max(80).optional(),
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(48).optional(),
});

/** GET — ommaviy kurslar katalogi (filtr/qidiruv) */
export const GET = handler(async (req) => {
  const { category, level, q, cursor, limit } = parseQuery(req.url, querySchema);
  return ok(await listCourses({ category, level, q, cursor: cursor ?? null, limit }));
});

/** POST — yangi kurs (faqat tasdiqlangan mentor) */
export const POST = handler(async (req) => {
  const session = await requireSession();
  const input = await parseBody(req, courseSchema);
  return ok(await createCourse(session.sub, input), { status: 201 });
});
