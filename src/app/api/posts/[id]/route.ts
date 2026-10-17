import { ApiError, handler, ok, requireSession } from "@/lib/api";
import { canModeratePost, deletePost, loadPost } from "@/lib/groups/service";
import { audit } from "@/lib/security/audit";

type Ctx = { params: Promise<{ id: string }> };

/** DELETE: postni o'chirish — muallif, jamoa egasi/admin yoki sayt admini */
export const DELETE = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const post = await loadPost(id);
  if (!post) throw new ApiError(404, "Post topilmadi");
  if (!(await canModeratePost(post, { id: session.sub, role: session.role }))) throw new ApiError(403, "Ruxsat yo'q");
  await deletePost(post);
  if (post.authorId !== session.sub) await audit(session.sub, "post_delete", { targetType: "post", targetId: post.id, meta: { authorId: post.authorId } }, req);
  return ok({ deleted: true });
});
