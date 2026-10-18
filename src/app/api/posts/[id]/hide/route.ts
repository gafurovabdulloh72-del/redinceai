import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { loadPost } from "@/lib/groups/service";
import { setPostHidden } from "@/lib/groups/posts-extra";
import { enforceLimit } from "@/lib/security/rate-limit";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({ hidden: z.boolean().optional().default(true) });

/** POST { hidden } — «Qiziq emas»: postni o'z lentamdan yashirish / qaytarish (faqat o'zimga ta'sir qiladi) */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = req.headers.get("content-type")?.includes("application/json") ? await parseBody(req, schema) : { hidden: true };
  await enforceLimit("feedActions", session.sub);
  const post = await loadPost(id);
  if (!post) throw new ApiError(404, "Post topilmadi");
  if (post.authorId === session.sub) throw new ApiError(400, "O'z postingizni yashirib bo'lmaydi — o'chirishingiz mumkin");
  return ok(await setPostHidden(post.id, session.sub, input.hidden));
});
