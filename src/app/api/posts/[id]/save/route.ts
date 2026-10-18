import { eq } from "drizzle-orm";
import { ApiError, handler, ok, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { groups } from "@/lib/db/schema";
import { assertCanView, loadPost, toggleSave } from "@/lib/groups/service";
import { enforceLimit } from "@/lib/security/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

/** POST: postni saqlash / saqlanganlardan olish (toggle). Yopiq jamoa posti — faqat ko'ra oladiganlar. 120 / soat */
export const POST = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  await enforceLimit("social", session.sub);
  const post = await loadPost(id);
  if (!post) throw new ApiError(404, "Post topilmadi");
  if (post.groupId) {
    const group = await db.query.groups.findFirst({ where: eq(groups.id, post.groupId) });
    if (!group) throw new ApiError(404, "Jamoa topilmadi");
    await assertCanView(group, { id: session.sub, role: session.role });
  }
  return ok(await toggleSave(post, session.sub));
});
