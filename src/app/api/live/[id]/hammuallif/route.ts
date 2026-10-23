import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { listCohosts, toggleCohost } from "@/lib/live/zoom";

export const runtime = "nodejs";

/** GET — hammuallif id'lari (ro'yxatda belgi qo'yish uchun) */
export const GET = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  await requireSession();
  const { id } = await ctx.params;
  return ok({ items: await listCohosts(id) });
});

const bodySchema = z.object({ userId: z.string().min(1).max(64) });

/** POST — hammuallif qilish / olib tashlash (faqat boshlovchi) */
export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const input = await parseBody(req, bodySchema);
  return ok(await toggleCohost(id, { id: session.sub, role: session.role }, input.userId));
});
