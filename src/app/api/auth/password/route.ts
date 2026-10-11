import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { bumpSessionVersion, createSession, getSession } from "@/lib/auth";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { changePasswordSchema } from "@/lib/validators";
import { audit } from "@/lib/security/audit";
import { hashPassword, verifyPassword } from "@/lib/security/password";
import { enforceLimit } from "@/lib/security/rate-limit";
import { invalidatePasswordResets } from "@/lib/security/tokens";

/**
 * Parolni o'zgartirish: joriy parol tekshiriladi, yangi parol siyosatga mos bo'lishi kerak.
 * sessionVersion oshiriladi (boshqa qurilmalar chiqib ketadi), joriy qurilmaga yangi cookie beriladi.
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  await enforceLimit("password", session.sub);
  const input = await parseBody(req, changePasswordSchema);

  const user = await db.query.users.findFirst({ where: eq(users.id, session.sub) });
  if (!user) throw new ApiError(401, "Foydalanuvchi topilmadi");
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw new ApiError(422, "Joriy parol noto'g'ri", { currentPassword: "Joriy parol noto'g'ri" });
  }
  if (input.currentPassword === input.newPassword) {
    throw new ApiError(422, "Yangi parol eskisidan farq qilsin", { newPassword: "Yangi parol eskisidan farq qilsin" });
  }

  await db.update(users).set({ passwordHash: await hashPassword(input.newPassword), passwordChangedAt: new Date() }).where(eq(users.id, user.id));
  // Oldin so'ralgan (hali ishlatilmagan) tiklash havolalari yangi parolni qayta o'zgartira olmasin
  await invalidatePasswordResets(user.id);
  const sv = await bumpSessionVersion(user.id);
  const current = await getSession();
  await createSession({ id: user.id, role: user.role, name: user.name, sessionVersion: sv }, { remember: current?.remember ?? true });
  await audit(user.id, "password_changed", { targetType: "user", targetId: user.id }, req);
  return ok({ changed: true });
});
