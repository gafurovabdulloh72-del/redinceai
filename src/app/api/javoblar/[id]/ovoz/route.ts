import { handler, ok, requireSession } from "@/lib/api";
import { voteAnswer } from "@/lib/qa/service";

type Ctx = { params: Promise<{ id: string }> };

/** POST — «Foydali» belgisi (toggle; o'z javobiga bo'lmaydi) */
export const POST = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  return ok(await voteAnswer(session.sub, id));
});
