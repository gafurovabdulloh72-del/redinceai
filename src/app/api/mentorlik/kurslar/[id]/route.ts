import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { enforceLimit } from "@/lib/security/rate-limit";
import { courseSchema } from "@/lib/mentorship/validators";
import { updateCourse } from "@/lib/mentorship/service";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH — kursni tahrirlash (faqat egasi) */
export const PATCH = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  await enforceLimit("mentor", session.sub);
  const { id } = await ctx.params;
  const input = await parseBody(req, courseSchema);
  await updateCourse(session.sub, id, input, session.role === "admin");
  return ok({ ok: true });
});
