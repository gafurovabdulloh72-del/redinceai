import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { loadViewablePost } from "@/lib/social/post-access";
import { REACTION_KINDS, type ReactionKind } from "@/lib/groups/limits";
import { assertActiveMember, setReaction } from "@/lib/groups/service";
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
  const viewer = { id: session.sub, role: session.role };
  const { post, group } = await loadViewablePost(id, viewer, { unlocked: true });
  if (group) {
    await assertActiveMember(group, viewer);
  } else {
    await assertCanInteractProfilePost(session.sub, post.authorId, "react");
  }
  return ok(await setReaction(post, session.sub, input.reaction));
});
