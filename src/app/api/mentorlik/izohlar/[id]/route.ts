import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { deleteLessonComment, setCommentHelpful } from "@/lib/mentorship/learning";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH {helpful} — ustoz «foydali» deb belgilaydi */
export const PATCH = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, z.object({ helpful: z.boolean() }));
  await setCommentHelpful(id, session.sub, session.role === "admin", input.helpful);
  return ok({ updated: true });
});

export const DELETE = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  await deleteLessonComment(id, session.sub, session.role === "admin");
  return ok({ deleted: true });
});
