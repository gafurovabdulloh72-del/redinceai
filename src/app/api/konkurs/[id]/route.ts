import { ApiError, handler, ok } from "@/lib/api";
import { getVerifiedSession } from "@/lib/auth";
import { getChallenge } from "@/lib/challenges/service";

type Ctx = { params: Promise<{ id: string }> };

/** GET — konkurs tafsiloti: ishlar (ovozlar bo'yicha), ko'ruvchining ishtiroki/ovozi */
export const GET = handler(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const session = await getVerifiedSession();
  const c = await getChallenge(id, session?.sub ?? null);
  if (!c) throw new ApiError(404, "Konkurs topilmadi");
  return ok(c);
});
