import { handler, ok, requireSession } from "@/lib/api";
import { deleteAnswer } from "@/lib/qa/service";

type Ctx = { params: Promise<{ id: string }> };

/** DELETE — javobni o'chirish (egasi yoki admin) */
export const DELETE = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  await deleteAnswer(session.sub, session.role === "admin", id);
  return ok({ deleted: true });
});
