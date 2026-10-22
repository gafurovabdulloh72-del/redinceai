import { handler, ok, requireSession } from "@/lib/api";
import { enroll } from "@/lib/mentorship/service";

type Ctx = { params: Promise<{ id: string }> };

/** POST — kursga yozilish */
export const POST = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  return ok(await enroll(session.sub, id, session.role === "admin"), { status: 201 });
});
