import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { lessonSchema } from "@/lib/mentorship/validators";
import { addLesson } from "@/lib/mentorship/service";

type Ctx = { params: Promise<{ id: string }> };

/** POST — kursga yangi dars qo'shish (faqat egasi) */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, lessonSchema);
  return ok(await addLesson(session.sub, id, input), { status: 201 });
});
