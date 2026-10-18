import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { ApiError, handler, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { groups } from "@/lib/db/schema";
import { assertCanView, loadPost, recordView } from "@/lib/groups/service";
import { enforceLimit } from "@/lib/security/rate-limit";
import { optionalViewer } from "@/app/api/groups/_lib";

type Ctx = { params: Promise<{ id: string }> };

/** Mehmon kaliti: IP + User-Agent xeshi (shaxsiy ma'lumot saqlanmaydi; tuz — server kaliti) */
function anonKey(req: Request): string {
  const ip = (req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "0").split(",")[0].trim();
  const ua = req.headers.get("user-agent") ?? "";
  const salt = process.env.AUTH_SECRET ?? process.env.TURSO_AUTH_TOKEN ?? "views";
  return `a:${createHash("sha256").update(`${salt}|${ip}|${ua}`).digest("hex").slice(0, 24)}`;
}

/**
 * POST: post ko'rildi — bir foydalanuvchi (yoki mehmon IP+UA xeshi) uchun kuniga bir marta hisoblanadi; muallifning o'zi hisoblanmaydi.
 * Yopiq jamoa posti — faqat ko'ra oladiganlar. Javob: { views } (yangi son).
 */
export const POST = handler(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const viewer = await optionalViewer();
  const key = viewer ? `u:${viewer.id}` : anonKey(req);
  await enforceLimit("views", key);
  const post = await loadPost(id);
  if (!post) throw new ApiError(404, "Post topilmadi");
  if (post.groupId) {
    const group = await db.query.groups.findFirst({ where: eq(groups.id, post.groupId) });
    if (!group) throw new ApiError(404, "Jamoa topilmadi");
    await assertCanView(group, viewer);
  }
  return ok({ views: await recordView(post, key, viewer?.id ?? null) });
});
