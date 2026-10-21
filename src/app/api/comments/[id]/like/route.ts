import { eq } from "drizzle-orm";
import { ApiError, handler, ok, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { groups, postComments } from "@/lib/db/schema";
import { assertActiveMember, loadPost } from "@/lib/groups/service";
import { toggleCommentLike } from "@/lib/groups/posts-extra";
import { assertCanInteractProfilePost } from "@/lib/privacy/blocks";
import { enforceLimit } from "@/lib/security/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST: izohni yoqtirish / yoqtirishni olish (toggle) → `{ liked, likesCount }`.
 * Ruxsat post bilan bir xil: profil posti — har qanday kirgan foydalanuvchi (blok bo'lmasa); jamoa posti — faqat faol a'zolar. 120 / soat.
 */
export const POST = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  await enforceLimit("social", session.sub);
  const comment = await db.query.postComments.findFirst({ where: eq(postComments.id, id) });
  if (!comment) throw new ApiError(404, "Izoh topilmadi");
  const post = await loadPost(comment.postId);
  if (!post) throw new ApiError(404, "Post topilmadi");
  if (post.groupId) {
    const group = await db.query.groups.findFirst({ where: eq(groups.id, post.groupId) });
    if (!group) throw new ApiError(404, "Jamoa topilmadi");
    await assertActiveMember(group, { id: session.sub, role: session.role });
  } else {
    await assertCanInteractProfilePost(session.sub, post.authorId, "react");
  }
  return ok(await toggleCommentLike(comment, post, session.sub));
});
