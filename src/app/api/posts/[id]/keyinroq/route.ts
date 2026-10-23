import { handler, ok, requireSession } from "@/lib/api";
import { toggleWatchLater } from "@/lib/social/library";
import { enforceLimit } from "@/lib/security/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

/** POST: «Keyinroq ko'rish» navbatiga qo'shish / olib tashlash (toggle) */
export const POST = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  await enforceLimit("social", session.sub);
  return ok(await toggleWatchLater(session.sub, id));
});
