import { handler, ok, requireSession } from "@/lib/api";
import { deleteLessonNote } from "@/lib/mentorship/learning";

type Ctx = { params: Promise<{ id: string }> };

/** Eslatmani o'chirish — faqat egasi */
export const DELETE = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  await deleteLessonNote(id, session.sub);
  return ok({ deleted: true });
});
