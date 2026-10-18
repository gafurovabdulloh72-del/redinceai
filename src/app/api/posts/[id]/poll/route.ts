import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { loadPost } from "@/lib/groups/service";
import { createPoll } from "@/lib/groups/posts-extra";
import { POLL_OPTIONS_MAX, POLL_OPTION_MAX } from "@/lib/groups/limits";
import { enforceLimit } from "@/lib/security/rate-limit";

type Ctx = { params: Promise<{ id: string }> };
const schema = z.object({
  options: z.array(z.string().trim().max(POLL_OPTION_MAX, `Variant ko'pi bilan ${POLL_OPTION_MAX} belgi`)).max(POLL_OPTIONS_MAX + 2),
  /** Tugash vaqti (ms) — ixtiyoriy */
  endsAt: z.coerce.number().int().positive().nullable().optional(),
});

/**
 * POST { options, endsAt? } — postga so'rovnoma biriktirish (faqat muallif, post joylangandan keyin 10 daqiqa ichida;
 * bitta post = bitta so'rovnoma). Kompozitor: avval post, keyin shu route.
 */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, schema);
  await enforceLimit("feedActions", session.sub);
  const post = await loadPost(id);
  if (!post) throw new ApiError(404, "Post topilmadi");
  if (post.authorId !== session.sub) throw new ApiError(403, "Faqat muallif so'rovnoma qo'shadi");
  if (Date.now() - post.createdAt.getTime() > 10 * 60_000) throw new ApiError(409, "So'rovnoma faqat yangi postga qo'shiladi");
  return ok(await createPoll(post, input.options, input.endsAt ?? null), { status: 201 });
});
