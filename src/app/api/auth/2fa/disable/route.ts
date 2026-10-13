import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { notify } from "@/lib/notifications";
import { audit } from "@/lib/security/audit";
import { verifyPassword } from "@/lib/security/password";
import { enforceLimit } from "@/lib/security/rate-limit";
import { consumeSecondFactor, secondFactorCode } from "@/lib/security/two-factor";

const schema = z.object({
  password: z.string().min(1, "Parolni kiriting").max(200),
  code: secondFactorCode,
});

/**
 * 2FA'ni o'chirish: joriy parol + ilovadagi kod (yoki zaxira kodi) majburiy. Sir va zaxira kodlari o'chiriladi.
 * Rate limit: parol o'zgartirish bilan bir xil (5 / 15 daqiqa).
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  await enforceLimit("password", session.sub);
  const input = await parseBody(req, schema);

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.sub),
    columns: { id: true, passwordHash: true, totpEnabled: true, totpSecretEnc: true, recoveryCodes: true },
  });
  if (!user) throw new ApiError(401, "Foydalanuvchi topilmadi");
  if (!user.totpEnabled) throw new ApiError(409, "Ikki bosqichli himoya yoqilmagan");
  if (!(await verifyPassword(input.password, user.passwordHash))) {
    throw new ApiError(422, "Parol noto'g'ri", { password: "Parol noto'g'ri" });
  }
  const kind = await consumeSecondFactor(user, input.code);
  if (!kind) throw new ApiError(422, "Kod noto'g'ri yoki eskirgan", { code: "Kod noto'g'ri yoki eskirgan" });

  await db.update(users).set({ totpEnabled: false, totpSecretEnc: null, recoveryCodes: [] }).where(eq(users.id, user.id));
  await audit(user.id, "2fa_disabled", { targetType: "user", targetId: user.id, meta: { via: kind } }, req);
  await notify(user.id, "account", "Ikki bosqichli himoya o'chirildi", "Agar buni siz qilmagan bo'lsangiz, darhol parolingizni o'zgartiring va himoyani qayta yoqing.", "/kabinet/xavfsizlik");
  return ok({ disabled: true });
});
