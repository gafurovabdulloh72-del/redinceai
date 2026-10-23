import { eq } from "drizzle-orm";
import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { postComments } from "@/lib/db/schema";
import { loadPost } from "@/lib/groups/service";
import { setCommentPinned } from "@/lib/groups/posts-extra";
import { enforceLimit } from "@/lib/security/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

/** POST {pinned}: izohni qadash / qadashni olish — faqat post muallifi yoki sayt admini */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const { pinned } = await parseBody(req, z.object({ pinned: z.boolean() }));
  await enforceLimit("social", session.sub);
  const comment = await db.query.postComments.findFirst({ where: eq(postComments.id, id) });
  if (!comment) throw new ApiError(404, "Izoh topilmadi");
  const post = await loadPost(comment.postId);
  if (!post) throw new ApiError(404, "Post topilmadi");
  return ok(await setCommentPinned(comment, post, { id: session.sub, role: session.role }, pinned));
});
