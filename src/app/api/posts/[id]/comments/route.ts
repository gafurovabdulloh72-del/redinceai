import { z } from "zod";
import { eq } from "drizzle-orm";
import { ApiError, handler, ok, parseBody, parseQuery, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { groups } from "@/lib/db/schema";
import { assertActiveMember, assertCanView, loadPost } from "@/lib/groups/service";
import { addCommentX, listCommentsX } from "@/lib/groups/posts-extra";
import { commentInputSchema } from "@/lib/groups/validators";
import { enforceLimit } from "@/lib/security/rate-limit";
import { optionalViewer } from "@/app/api/groups/_lib";
import { assertCanInteractProfilePost } from "@/lib/privacy/blocks";

type Ctx = { params: Promise<{ id: string }> };
const querySchema = z.object({ sort: z.enum(["old", "new"]).optional().default("old") });
const createSchema = commentInputSchema.extend({
  /** Javob (1 daraja) — shu postdagi izoh id'si */
  replyToId: z.string().trim().max(64).nullable().optional(),
});

async function postAndGroup(id: string) {
  const post = await loadPost(id);
  if (!post) throw new ApiError(404, "Post topilmadi");
  const group = post.groupId ? await db.query.groups.findFirst({ where: eq(groups.id, post.groupId) }) : null;
  return { post, group };
}

/** GET ?sort=old|new — izohlar (standart eski → yangi) + jami soni (`total`) */
export const GET = handler(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { sort } = parseQuery(req.url, querySchema);
  const { post, group } = await postAndGroup(id);
  const viewer = await optionalViewer();
  if (group) await assertCanView(group, viewer);
  return ok(await listCommentsX(post, viewer, { sort }));
});

/** POST { body, replyToId? }: izoh qoldirish — jamoa posti: faol a'zo; profil posti: kirgan (blok/siyosat tekshiruvi), 60 / soat */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, createSchema);
  const { post, group } = await postAndGroup(id);
  const viewer = { id: session.sub, role: session.role };
  if (group) await assertActiveMember(group, viewer);
  else await assertCanInteractProfilePost(session.sub, post.authorId, "comment");
  await enforceLimit("comments", session.sub);
  const c = await addCommentX(post, session.sub, input.body, input.replyToId ?? null);
  return ok({ id: c.id }, { status: 201 });
});
