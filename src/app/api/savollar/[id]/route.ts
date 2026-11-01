import { getVerifiedSession } from "@/lib/auth";
import { handler, ok, requireSession } from "@/lib/api";
import { deleteQuestion, getQuestion } from "@/lib/qa/service";
import { ApiError } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

/** GET — savol tafsiloti (ommaviy; kirgan bo'lsa o'z ovozi/javobi belgilanadi) */
export const GET = handler(async (_req, ctx: Ctx) => {
  const session = await getVerifiedSession();
  const { id } = await ctx.params;
  const q = await getQuestion(id, session?.sub ?? null);
  if (!q) throw new ApiError(404, "Savol topilmadi");
  return ok(q);
});

/** DELETE — savolni o'chirish (egasi yoki admin) */
export const DELETE = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  await deleteQuestion(session.sub, session.role === "admin", id);
  return ok({ deleted: true });
});
