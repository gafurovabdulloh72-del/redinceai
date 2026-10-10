import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { bumpSessionVersion, createSession, getSession } from "@/lib/auth";
import { ApiError, handler, ok, requireSession } from "@/lib/api";
import { audit } from "@/lib/security/audit";

/** Joriy sessiya haqida ma'lumot (xavfsizlik sahifasi uchun) */
export const GET = handler(async () => {
  const session = await requireSession();
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.sub),
    columns: { lastLoginAt: true, passwordChangedAt: true, sessionVersion: true, emailVerified: true, createdAt: true },
  });
  if (!user) throw new ApiError(401, "Foydalanuvchi topilmadi");
  return ok(
    {
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
 * "Barcha qurilmalardan chiqish": sessionVersion oshiriladi — barcha eski cookie'lar bekor,
 * joriy qurilma uchun yangi cookie beriladi (foydalanuvchi shu yerda qolaveradi).
 */
export const DELETE = handler(async (req) => {
  const session = await requireSession();
  const sv = await bumpSessionVersion(session.sub);
  const current = await getSession();
  await createSession({ id: session.sub, role: session.role, name: session.name, sessionVersion: sv }, { remember: current?.remember ?? true });
  await audit(session.sub, "logout_all", { targetType: "user", targetId: session.sub }, req);
  return ok({ revoked: true, sessionVersion: sv });
});
