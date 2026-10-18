import { eq } from "drizzle-orm";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { groups } from "@/lib/db/schema";
import { addComment, assertActiveMember, assertCanView, listComments, loadPost } from "@/lib/groups/service";
import { commentInputSchema } from "@/lib/groups/validators";
import { enforceLimit } from "@/lib/security/rate-limit";
import { optionalViewer } from "@/app/api/groups/_lib";
import { assertCanInteractProfilePost } from "@/lib/privacy/blocks";

type Ctx = { params: Promise<{ id: string }> };

async function postAndGroup(id: string) {
  const post = await loadPost(id);
  if (!post) throw new ApiError(404, "Post topilmadi");
  const group = post.groupId ? await db.query.groups.findFirst({ where: eq(groups.id, post.groupId) }) : null;
  return { post, group };
}

/** GET: izohlar (eski → yangi) */
export const GET = handler(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { post, group } = await postAndGroup(id);
  const viewer = await optionalViewer();
  if (group) await assertCanView(group, viewer);
  return ok({ items: await listComments(post, viewer) });
});

/** POST: izoh qoldirish — faqat jamoa a'zolari, 60 / soat */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, commentInputSchema);
  const { post, group } = await postAndGroup(id);
  const viewer = { id: session.sub, role: session.role };
  if (group) await assertActiveMember(group, viewer);
  else await assertCanInteractProfilePost(session.sub, post.authorId, "comment");
  await enforceLimit("comments", session.sub);
  const c = await addComment(post, session.sub, input.body);
  return ok({ id: c.id }, { status: 201 });
});
