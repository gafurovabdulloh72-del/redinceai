import { z } from "zod";
import { handler, ok, parseQuery, requireSession } from "@/lib/api";
import { followState, listFollowers, toggleFollow } from "@/lib/groups/service";
import { enforceLimit } from "@/lib/security/rate-limit";
import { optionalViewer } from "@/app/api/groups/_lib";

type Ctx = { params: Promise<{ userId: string }> };

const listQuery = z.object({ list: z.enum(["followers", "following"]).optional(), cursor: z.coerce.number().int().positive().optional() });

/** GET: obuna holati va sonlar (ommaviy); ?list=followers|following — ro'yxat (faqat kirganlarga, cursor bilan). POST: obuna bo'lish / bekor qilish */
export const GET = handler(async (req, ctx: Ctx) => {
  const { userId } = await ctx.params;
  const viewer = await optionalViewer();
  const q = parseQuery(req.url, listQuery);
  if (q.list) {
    // Audit: ro'yxat (ismlar, taxalluslar, onlayn holat) mehmonlarga berilmaydi — skreyping va profil yig'ishni cheklaydi
    const session = await requireSession();
    await enforceLimit("social", session.sub);
    return ok(await listFollowers(userId, q.list, viewer, q.cursor ?? null));
  }
  return ok(await followState(viewer?.id ?? null, userId));
});

export const POST = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { userId } = await ctx.params;
  await enforceLimit("social", session.sub);
  return ok(await toggleFollow(session.sub, userId));
});
