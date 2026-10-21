import { handler, ok, requireSession } from "@/lib/api";
import { storyViewers } from "@/lib/stories/service";

type Ctx = { params: Promise<{ id: string }> };

/** GET: story'ni kim ko'rdi — faqat muallif/admin */
export const GET = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  return ok({ items: await storyViewers(id, { id: session.sub, role: session.role }) });
});
