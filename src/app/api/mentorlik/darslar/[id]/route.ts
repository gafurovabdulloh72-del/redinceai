import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { lessonSchema } from "@/lib/mentorship/validators";
import { deleteLesson, updateLesson } from "@/lib/mentorship/service";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH — darsni tahrirlash (faqat egasi) */
export const PATCH = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, lessonSchema);
  await updateLesson(session.sub, id, input, session.role === "admin");
  return ok({ ok: true });
});

/** DELETE — darsni o'chirish (faqat egasi) */
export const DELETE = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  await deleteLesson(session.sub, id, session.role === "admin");
  return ok({ ok: true });
});
