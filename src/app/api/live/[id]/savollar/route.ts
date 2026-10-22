import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { enforceLimit } from "@/lib/security/rate-limit";
import { askQuestion, listQuestions, markQuestionAnswered, toggleQuestionVote } from "@/lib/live/interactive";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  return ok({ items: await listQuestions(id, { id: session.sub, role: session.role }) });
});

/** POST {body} — savol; {vote: id} — ovoz (qayta bosilsa olinadi); {answered: id, value} — boshlovchi «javob berildi» */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const v = { id: session.sub, role: session.role };
  const input = await parseBody(req, z.union([z.object({ body: z.string().max(300) }), z.object({ vote: z.string().max(64) }), z.object({ answered: z.string().max(64), value: z.boolean().default(true) })]));
  await enforceLimit("comments", session.sub);
  if ("body" in input) await askQuestion(id, v, input.body);
  else if ("vote" in input) await toggleQuestionVote(id, v, input.vote);
  else await markQuestionAnswered(id, v, input.answered, input.value);
  return ok({ done: true }, { status: 201 });
});
