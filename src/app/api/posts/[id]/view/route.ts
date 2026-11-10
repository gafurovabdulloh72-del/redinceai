import { createHash } from "node:crypto";
import { handler, ok } from "@/lib/api";
import { recordView } from "@/lib/groups/service";
import { isPostLocked, loadViewablePost } from "@/lib/social/post-access";
import { enforceLimit } from "@/lib/security/rate-limit";
import { clientIp } from "@/lib/security/request";
import { optionalViewer } from "@/app/api/groups/_lib";

type Ctx = { params: Promise<{ id: string }> };

/** Mehmon kaliti: IP + User-Agent xeshi (shaxsiy ma'lumot saqlanmaydi; tuz — server kaliti) */
function anonKey(req: Request): string {
  // Ishonchli proksi qo'ygan IP (x-forwarded-for'ning chapdagi qiymatini mijoz o'zi yozishi mumkin — unga tayanilmaydi)
  const ip = clientIp(req);
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
  const { post } = await loadViewablePost(id, viewer);
  // Qulflangan (obunachilarga yopiq) postni ko'rmagan odam «ko'rdi» deb sanalmaydi
  if (await isPostLocked(post, viewer)) return ok({ views: post.viewsCount });
  return ok({ views: await recordView(post, key, viewer?.id ?? null) });
});
