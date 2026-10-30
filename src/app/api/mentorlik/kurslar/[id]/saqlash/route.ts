import { handler, ok, requireSession } from "@/lib/api";
import { enforceLimit } from "@/lib/security/rate-limit";
import { toggleCourseSave } from "@/lib/mentorship/service";

type Ctx = { params: Promise<{ id: string }> };

/** POST — kursni saqlash / saqlanganlardan olish (toggle, Udemy wishlist) */
export const POST = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  await enforceLimit("social", session.sub);
  const { id } = await ctx.params;
  return ok(await toggleCourseSave(id, session.sub, session.role === "admin"));
});
