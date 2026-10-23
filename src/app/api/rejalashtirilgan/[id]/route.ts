import { handler, ok, requireSession } from "@/lib/api";
import { cancelScheduled } from "@/lib/social/instagram";

type Ctx = { params: Promise<{ id: string }> };

/** DELETE: rejani bekor qilish (joylanmagan bo'lsa) */
export const DELETE = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  await cancelScheduled(id, session.sub, session.role === "admin");
  return ok({ cancelled: true });
});
