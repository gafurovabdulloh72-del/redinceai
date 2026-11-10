import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { assertActiveMember } from "@/lib/groups/service";
import { loadViewablePost } from "@/lib/social/post-access";
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
  const viewer = { id: session.sub, role: session.role };
  const { post, group } = await loadViewablePost(id, viewer, { unlocked: true });
  if (group) {
    await assertActiveMember(group, viewer);
  } else {
    await assertCanInteractProfilePost(session.sub, post.authorId, "react");
  }
  return ok(await votePoll(post, session.sub, input.option));
});
