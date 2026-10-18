import { z } from "zod";
import { eq } from "drizzle-orm";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { groups } from "@/lib/db/schema";
import { REACTION_KINDS, type ReactionKind } from "@/lib/groups/limits";
import { assertActiveMember, loadPost, setReaction } from "@/lib/groups/service";
import { enforceLimit } from "@/lib/security/rate-limit";
import { assertCanInteractProfilePost } from "@/lib/privacy/blocks";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ reaction: z.enum(REACTION_KINDS).default("heart") });

/**
 * POST: reaksiya qo'yish/olish/almashtirish — body `{ reaction }` (standart ❤️ heart; body'siz chaqiruv ham ishlaydi).
 * Profil posti — har qanday kirgan foydalanuvchi; jamoa posti — faqat faol a'zolar (admin ham). 120 / soat.
 */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = req.headers.get("content-type")?.includes("application/json") ? await parseBody(req, schema) : { reaction: "heart" as ReactionKind };
  await enforceLimit("social", session.sub);
  const post = await loadPost(id);
  if (!post) throw new ApiError(404, "Post topilmadi");
  if (post.groupId) {
    const group = await db.query.groups.findFirst({ where: eq(groups.id, post.groupId) });
    if (!group) throw new ApiError(404, "Jamoa topilmadi");
    await assertActiveMember(group, { id: session.sub, role: session.role });
  } else {
    await assertCanInteractProfilePost(session.sub, post.authorId, "react");
  }
  return ok(await setReaction(post, session.sub, input.reaction));
});
