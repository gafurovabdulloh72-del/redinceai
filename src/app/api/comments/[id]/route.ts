import { z } from "zod";
import { eq } from "drizzle-orm";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { postComments } from "@/lib/db/schema";
import { canModeratePost, deleteComment, loadPost } from "@/lib/groups/service";
import { editComment } from "@/lib/groups/posts-extra";
import { COMMENT_MAX } from "@/lib/groups/limits";
import { enforceLimit } from "@/lib/security/rate-limit";

type Ctx = { params: Promise<{ id: string }> };
const patchSchema = z.object({ body: z.string().trim().min(1, "Izoh bo'sh").max(COMMENT_MAX, `Izoh ko'pi bilan ${COMMENT_MAX} belgi`) });

async function commentAndPost(id: string) {
  const comment = await db.query.postComments.findFirst({ where: eq(postComments.id, id) });
  if (!comment) throw new ApiError(404, "Izoh topilmadi");
  const post = await loadPost(comment.postId);
  if (!post) throw new ApiError(404, "Post topilmadi");
  return { comment, post };
}

/** PATCH { body }: izohni tahrirlash — faqat muallif, 15 daqiqa ichida */
export const PATCH = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, patchSchema);
  await enforceLimit("comments", session.sub);
  const { comment } = await commentAndPost(id);
  const c = await editComment(comment, { id: session.sub, role: session.role }, input.body);
  return ok({ id: c.id, body: c.body, editedAt: c.editedAt?.getTime() ?? null });
});

/** DELETE: izohni o'chirish — muallif, post muallifi, jamoa moderatori yoki sayt admini */
export const DELETE = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const { comment, post } = await commentAndPost(id);
  const viewer = { id: session.sub, role: session.role };
  if (comment.authorId !== session.sub && !(await canModeratePost(post, viewer))) throw new ApiError(403, "Ruxsat yo'q");
  await deleteComment(comment, post);
  return ok({ deleted: true });
});
