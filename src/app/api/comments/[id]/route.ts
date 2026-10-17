import { eq } from "drizzle-orm";
import { ApiError, handler, ok, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { postComments } from "@/lib/db/schema";
import { canModeratePost, deleteComment, loadPost } from "@/lib/groups/service";

type Ctx = { params: Promise<{ id: string }> };

/** DELETE: izohni o'chirish — muallif, post muallifi, jamoa moderatori yoki sayt admini */
export const DELETE = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const comment = await db.query.postComments.findFirst({ where: eq(postComments.id, id) });
  if (!comment) throw new ApiError(404, "Izoh topilmadi");
  const post = await loadPost(comment.postId);
  if (!post) throw new ApiError(404, "Post topilmadi");
  const viewer = { id: session.sub, role: session.role };
  if (comment.authorId !== session.sub && !(await canModeratePost(post, viewer))) throw new ApiError(403, "Ruxsat yo'q");
  await deleteComment(comment, post);
  return ok({ deleted: true });
});
