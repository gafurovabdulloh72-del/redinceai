import { eq } from "drizzle-orm";
import { ApiError, handler, ok, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { postComments } from "@/lib/db/schema";
import { assertActiveMember } from "@/lib/groups/service";
import { loadViewablePost } from "@/lib/social/post-access";
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
  const viewer = { id: session.sub, role: session.role };
  // Postni ko'ra olmaydigan uning izohini ham yoqtira olmaydi (yopiq profil / «yaqin do'stlar» / qulflangan post)
  const { post, group } = await loadViewablePost(comment.postId, viewer, { unlocked: true });
  if (group) {
    await assertActiveMember(group, viewer);
  } else {
    await assertCanInteractProfilePost(session.sub, post.authorId, "react");
  }
  return ok(await toggleCommentLike(comment, post, session.sub));
});
