import { ApiError, handler, ok, requireSession } from "@/lib/api";
import { userAnalytics } from "@/lib/analytics/user-analytics";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/users/[id]/analytics — foydalanuvchining faollik tahlili (faqat admin) */
export const GET = handler(async (_req, ctx: Ctx) => {
  await requireSession(["admin"]);
  const { id } = await ctx.params;
  const data = await userAnalytics(id);
  if (!data) throw new ApiError(404, "Foydalanuvchi topilmadi");
  return ok(data);
});
