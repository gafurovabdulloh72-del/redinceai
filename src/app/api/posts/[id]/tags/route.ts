import { eq } from "drizzle-orm";
import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { posts } from "@/lib/db/schema";
import { setPostTags, TAGS_MAX } from "@/lib/social/instagram";
import { enforceLimit } from "@/lib/security/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

/** PUT {userIds, role}: postda belgilangan odamlarni almashtirish — faqat post muallifi */
export const PUT = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const { userIds, role } = await parseBody(req, z.object({ userIds: z.array(z.string().max(64)).max(TAGS_MAX), role: z.enum(["tagged", "collab"]).optional() }));
  await enforceLimit("social", session.sub);
  const post = await db.query.posts.findFirst({ where: eq(posts.id, id), columns: { id: true, authorId: true } });
  if (!post) throw new ApiError(404, "Post topilmadi");
  if (post.authorId !== session.sub && session.role !== "admin") throw new ApiError(403, "Faqat muallif belgilaydi");
  return ok({ tagged: await setPostTags(id, post.authorId, userIds, role ?? "tagged") });
});
