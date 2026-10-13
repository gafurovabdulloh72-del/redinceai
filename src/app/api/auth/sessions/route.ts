import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { bumpSessionVersion, createSession, getSession } from "@/lib/auth";
import { ApiError, handler, ok, requireSession } from "@/lib/api";
import { audit } from "@/lib/security/audit";
import { userAgent } from "@/lib/security/request";
import { listUserSessions } from "@/lib/security/sessions";

/**
 * Joriy sessiya haqida ma'lumot + faol sessiyalar ro'yxati (qurilma: brauzer + OS, "Shu qurilma" belgisi,
 * oxirgi faollik, kirgan vaqt). IP hash va xom user-agent qaytarilmaydi.
 */
export const GET = handler(async (req) => {
  const session = await requireSession();
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.sub),
    columns: { lastLoginAt: true, passwordChangedAt: true, sessionVersion: true, emailVerified: true, createdAt: true },
  });
  if (!user) throw new ApiError(401, "Foydalanuvchi topilmadi");
  const list = await listUserSessions(session.sub, session, userAgent(req));
  return ok(
    {
      sessions: list,
      remember: session.remember,
      sessionVersion: user.sessionVersion,
      lastLoginAt: user.lastLoginAt?.getTime() ?? null,
      passwordChangedAt: user.passwordChangedAt?.getTime() ?? null,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt.getTime(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
});

/**
 * "Barcha qurilmalardan chiqish": sessionVersion oshiriladi va barcha sessiya qatorlari bekor qilinadi —
 * eski cookie'lar ishlamaydi, joriy qurilma uchun yangi cookie (va yangi qator) beriladi.
 */
export const DELETE = handler(async (req) => {
  const session = await requireSession();
  const sv = await bumpSessionVersion(session.sub);
  const current = await getSession();
  await createSession({ id: session.sub, role: session.role, name: session.name, sessionVersion: sv }, { remember: current?.remember ?? true });
  await audit(session.sub, "logout_all", { targetType: "user", targetId: session.sub }, req);
  return ok({ revoked: true, sessionVersion: sv });
});
