import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { adminRevokeAllSessions, adminRevokeSession, adminUserSecurity } from "@/lib/admin/user-tools";
import { notify } from "@/lib/notifications";
import { audit } from "@/lib/security/audit";

type Ctx = { params: Promise<{ id: string }> };

/** Admin: foydalanuvchining kirish holati va faol sessiyalari (qurilma, oxirgi faollik — xom IP/user-agent chiqmaydi) */
export const GET = handler(async (_req, ctx: Ctx) => {
  const session = await requireSession(["admin"]);
  const { id } = await ctx.params;
  const data = await adminUserSecurity(id, session);
  if (!data) throw new ApiError(404, "Foydalanuvchi topilmadi");
  return ok(data);
});

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("revoke_all") }),
  z.object({ action: z.literal("revoke"), sessionId: z.string().min(1).max(64) }),
]);

/**
 * Admin: sessiyalarni tugatish — hammasini (`revoke_all`: sessiya versiyasi oshadi, barcha qurilmalardan chiqariladi)
 * yoki bittasini (`revoke`). O'z sessiyalaringiz uchun emas (Kabinet → Xavfsizlik — u yerda joriy qurilma saqlanadi).
 * Egasiga bildirishnoma ketadi (hisobda nima bo'lganini bilsin); har amal audit jurnalida.
 */
export const POST = handler(async (req, ctx: Ctx) => {
  const session = await requireSession(["admin"]);
  const { id } = await ctx.params;
  const input = await parseBody(req, schema);
  if (id === session.sub) throw new ApiError(400, "O'z sessiyalaringizni Kabinet → Xavfsizlik bo'limida boshqaring");
  const data = await adminUserSecurity(id, session);
  if (!data) throw new ApiError(404, "Foydalanuvchi topilmadi");

  if (input.action === "revoke") {
    if (!(await adminRevokeSession(id, input.sessionId))) throw new ApiError(404, "Sessiya topilmadi yoki allaqachon yopilgan");
    await audit(session.sub, "admin_sessions_revoked", { targetType: "user", targetId: id, meta: { name: data.user.name, all: false, count: 1 } }, req);
    return ok({ revoked: 1 });
  }

  const count = data.sessions.length;
  await adminRevokeAllSessions(id);
  await audit(session.sub, "admin_sessions_revoked", { targetType: "user", targetId: id, meta: { name: data.user.name, all: true, count } }, req);
  await notify(id, "account", "Barcha qurilmalardan chiqarildingiz", "Administratsiya xavfsizlik maqsadida hisobingizdagi barcha sessiyalarni yopdi. Qayta kiring; parolni eslamasangiz — kirish sahifasidagi «Parolni unutdingizmi?» havolasidan foydalaning.", "/kabinet/xavfsizlik");
  return ok({ revoked: count, all: true });
});
