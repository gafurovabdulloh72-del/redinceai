import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { eligiblePosts, submitEntry } from "@/lib/challenges/service";

type Ctx = { params: Promise<{ id: string }> };

/** GET — ishtirok uchun yaroqli o'z postlari (ommaviy, media'li, hali qo'shilmagan) */
export const GET = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  return ok({ items: await eligiblePosts(session.sub, id) });
});

const schema = z.object({ postId: z.string().trim().min(5).max(80) });

/** POST — o'z postini konkursga qo'shish (ochiq konkurs, 1 ta/odam) */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const { postId } = await parseBody(req, schema);
  return ok(await submitEntry(session.sub, id, postId), { status: 201 });
});
