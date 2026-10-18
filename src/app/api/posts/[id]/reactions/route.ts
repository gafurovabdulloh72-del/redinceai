import { z } from "zod";
import { eq } from "drizzle-orm";
import { ApiError, handler, ok, parseQuery } from "@/lib/api";
import { db } from "@/lib/db";
import { groups } from "@/lib/db/schema";
import { assertCanView, loadPost } from "@/lib/groups/service";
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
  const post = await loadPost(id);
  if (!post) throw new ApiError(404, "Post topilmadi");
  if (post.groupId) {
    const group = await db.query.groups.findFirst({ where: eq(groups.id, post.groupId) });
    if (!group) throw new ApiError(404, "Jamoa topilmadi");
    await assertCanView(group, viewer);
  }
  return ok({ items: await listReactors(post.id, kind ?? null) });
});
