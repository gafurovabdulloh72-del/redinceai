import { z } from "zod";
import { handler, ok, parseQuery } from "@/lib/api";
import { loadViewablePost } from "@/lib/social/post-access";
import { listReactors } from "@/lib/groups/posts-extra";
import { REACTION_KINDS } from "@/lib/groups/limits";
import { optionalViewer } from "@/app/api/groups/_lib";

type Ctx = { params: Promise<{ id: string }> };
const querySchema = z.object({ kind: z.enum(REACTION_KINDS).optional() });

/** GET ?kind= — «Kim reaksiya qo'ydi»: ism/avatar/reaksiya (kontakt yo'q). Yopiq jamoa posti — faqat ko'ra oladiganlar */
export const GET = handler(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { kind } = parseQuery(req.url, querySchema);
  const viewer = await optionalViewer();
  const { post } = await loadViewablePost(id, viewer, { unlocked: true });
  return ok({ items: await listReactors(post.id, kind ?? null) });
});
