import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { ANSWER_MAX, answerQuestion } from "@/lib/qa/service";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ body: z.string().trim().min(10, "Javob kamida 10 ta belgi bo'lsin").max(ANSWER_MAX) });

/** POST — savolga javob (bir savolga 1 ta) */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const { body } = await parseBody(req, schema);
  return ok(await answerQuestion(session.sub, id, body), { status: 201 });
});
