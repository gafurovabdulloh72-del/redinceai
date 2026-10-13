import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { bumpSessionVersion, createSession } from "@/lib/auth";
import { ApiError, handler, ok, parseBody } from "@/lib/api";
import { resetConfirmSchema } from "@/lib/validators";
import { audit } from "@/lib/security/audit";
import { hashPassword } from "@/lib/security/password";
import { clientIp, enforceLimit } from "@/lib/security/rate-limit";
import { consumePasswordReset } from "@/lib/security/tokens";

/**
 * Yangi parol o'rnatish (emaildagi token bilan). Token bir martalik; barcha eski sessiyalar
 * bekor qilinadi va foydalanuvchi shu qurilmada kiritiladi (2FA yoqilgan bo'lsa — yo'q: requiresLogin).
 */
export const POST = handler(async (req) => {
  await enforceLimit("resetConfirm", clientIp(req));
  const input = await parseBody(req, resetConfirmSchema);

  const userId = await consumePasswordReset(input.token);
  if (!userId) throw new ApiError(400, "Havola eskirgan yoki allaqachon ishlatilgan. Qaytadan so'rang");

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw new ApiError(400, "Foydalanuvchi topilmadi");

  await db.update(users).set({ passwordHash: await hashPassword(input.newPassword), passwordChangedAt: new Date(), lastLoginAt: new Date() }).where(eq(users.id, user.id));
  const sv = await bumpSessionVersion(user.id);
  await audit(user.id, "password_reset", { targetType: "user", targetId: user.id }, req);
  // 2FA yoqilgan bo'lsa email orqali tiklash ikkinchi omilni chetlab o'tmasin — kirish sahifasida kod bilan kiradi
  if (user.totpEnabled) return ok({ reset: true, name: user.name, role: user.role, requiresLogin: true });
  await createSession({ id: user.id, role: user.role, name: user.name, sessionVersion: sv }, { remember: false });
  return ok({ reset: true, name: user.name, role: user.role, requiresLogin: false });
});
