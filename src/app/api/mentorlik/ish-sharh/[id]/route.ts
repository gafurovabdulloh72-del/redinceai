import { handler, ok, requireSession } from "@/lib/api";
import { cancelWorkReview, getWorkReview } from "@/lib/mentorship/work-review";

type Ctx = { params: Promise<{ id: string }> };

/** GET — bitta so'rov: talaba / ustoz / admin; boshqalarga 404 */
export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  return ok(await getWorkReview(id, { id: session.sub, admin: session.role === "admin" }));
});

/** DELETE — talaba to'lanmagan so'rovini bekor qiladi */
export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  await cancelWorkReview(id, session.sub);
  return ok({ ok: true });
});
