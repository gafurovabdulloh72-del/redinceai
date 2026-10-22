import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { closePoll, createPoll, currentPoll, votePoll } from "@/lib/live/interactive";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  return ok({ poll: await currentPoll(id, { id: session.sub, role: session.role }) });
});

/** POST {question, options} — boshlovchi yaratadi; {vote: idx} — ovoz; {close: true} — boshlovchi yopadi */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const v = { id: session.sub, role: session.role };
  const input = await parseBody(req, z.union([z.object({ question: z.string().max(140), options: z.array(z.string().max(60)).min(2).max(5) }), z.object({ vote: z.number().int().min(0).max(4) }), z.object({ close: z.literal(true) })]));
  if ("question" in input) await createPoll(id, v, input.question, input.options);
  else if ("vote" in input) await votePoll(id, v, input.vote);
  else await closePoll(id, v);
  return ok({ done: true }, { status: 201 });
});
