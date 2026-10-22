import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { lessonCommentSchema } from "@/lib/mentorship/validators";
import { addLessonComment, listLessonComments } from "@/lib/mentorship/learning";
import { enforceLimit } from "@/lib/security/rate-limit";
import { assertNotSpam } from "@/lib/security/spam-filter";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  return ok({ items: await listLessonComments(id, session.sub, session.role === "admin") });
});

export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, lessonCommentSchema);
  await enforceLimit("comments", session.sub);
  await assertNotSpam(input.body, "body");
  return ok(await addLessonComment(id, session.sub, session.role === "admin", input), { status: 201 });
});
