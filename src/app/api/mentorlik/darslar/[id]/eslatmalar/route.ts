import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { lessonNoteSchema } from "@/lib/mentorship/validators";
import { addLessonNote, listLessonNotes } from "@/lib/mentorship/learning";
import { enforceLimit } from "@/lib/security/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

/** Dars eslatmalari (Udemy «Notes») — faqat o'zinikini ko'radi/yozadi; kursga yozilgan bo'lishi shart */
export const GET = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  return ok({ items: await listLessonNotes(id, session.sub, session.role === "admin") });
});

export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, lessonNoteSchema);
  await enforceLimit("mentor", session.sub);
  return ok(await addLessonNote(id, session.sub, session.role === "admin", input), { status: 201 });
});
