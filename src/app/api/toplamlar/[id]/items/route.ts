import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { toggleInCollection } from "@/lib/social/library";
import { enforceLimit } from "@/lib/security/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

/** POST {postId}: postni to'plamga qo'shish / olib tashlash (toggle) */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const { postId } = await parseBody(req, z.object({ postId: z.string().min(1).max(64) }));
  await enforceLimit("social", session.sub);
  return ok(await toggleInCollection(id, { id: session.sub, role: session.role }, postId));
});
