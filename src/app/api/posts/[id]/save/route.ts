import { handler, ok, requireSession } from "@/lib/api";
import { toggleSave } from "@/lib/groups/service";
import { loadViewablePost } from "@/lib/social/post-access";
import { enforceLimit } from "@/lib/security/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

/** POST: postni saqlash / saqlanganlardan olish (toggle). Yopiq jamoa posti — faqat ko'ra oladiganlar. 120 / soat */
export const POST = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  await enforceLimit("social", session.sub);
  const { post } = await loadViewablePost(id, { id: session.sub, role: session.role });
  return ok(await toggleSave(post, session.sub));
});
