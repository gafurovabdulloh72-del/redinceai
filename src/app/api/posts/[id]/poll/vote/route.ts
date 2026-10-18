import { z } from "zod";
import { eq } from "drizzle-orm";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { groups } from "@/lib/db/schema";
import { assertActiveMember, loadPost } from "@/lib/groups/service";
import { votePoll } from "@/lib/groups/posts-extra";
import { assertCanInteractProfilePost } from "@/lib/privacy/blocks";
import { enforceLimit } from "@/lib/security/rate-limit";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ option: z.coerce.number().int().min(0).max(9) });

/**
 * POST { option } — so'rovnomada ovoz berish (shu variant → qaytariladi, boshqasi → almashadi).
 * Profil posti — kirgan har kim (blok bo'lmasa); jamoa posti — faol a'zo. Javob: yangilangan PollView.
 */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, schema);
  await enforceLimit("feedActions", session.sub);
  const post = await loadPost(id);
  if (!post) throw new ApiError(404, "Post topilmadi");
  if (post.groupId) {
    const group = await db.query.groups.findFirst({ where: eq(groups.id, post.groupId) });
    if (!group) throw new ApiError(404, "Jamoa topilmadi");
    await assertActiveMember(group, { id: session.sub, role: session.role });
  } else {
    await assertCanInteractProfilePost(session.sub, post.authorId, "react");
  }
  return ok(await votePoll(post, session.sub, input.option));
});
