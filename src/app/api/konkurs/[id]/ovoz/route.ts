import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { voteEntry } from "@/lib/challenges/service";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ entryId: z.string().trim().min(5).max(80) });

/** POST — ishga ovoz (bor ovoz shu ishda bo'lsa — bekor, boshqasida bo'lsa — ko'chadi) */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const { entryId } = await parseBody(req, schema);
  return ok(await voteEntry(session.sub, id, entryId));
});
