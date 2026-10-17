import { ApiError, handler, ok, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { groups } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { assertActiveMember, loadPost, toggleLike } from "@/lib/groups/service";
import { enforceLimit } from "@/lib/security/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

/** POST: like / like'ni olib tashlash (faqat jamoa a'zolari) */
export const POST = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  await enforceLimit("social", session.sub);
  const post = await loadPost(id);
  if (!post) throw new ApiError(404, "Post topilmadi");
  if (post.groupId) {
    const group = await db.query.groups.findFirst({ where: eq(groups.id, post.groupId) });
    if (!group) throw new ApiError(404, "Jamoa topilmadi");
    await assertActiveMember(group, { id: session.sub, role: session.role });
  }
  return ok(await toggleLike(post, session.sub));
});
