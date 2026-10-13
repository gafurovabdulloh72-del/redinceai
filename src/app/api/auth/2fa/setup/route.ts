import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { ApiError, handler, ok, requireSession } from "@/lib/api";
import { audit } from "@/lib/security/audit";
import { enforceLimit } from "@/lib/security/rate-limit";
import { encryptTotpSecret, generateTotpSecret, otpauthUri } from "@/lib/security/totp";

/**
 * 2FA sozlashni boshlash: yangi TOTP siri yaratiladi (shifrlangan holda saqlanadi, totpEnabled hali false) va
 * otpauth:// havola + base32 sir qaytariladi. Yoqish — POST /api/auth/2fa/enable {code}. Rate limit: 10 / soat.
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  await enforceLimit("twoFactorSetup", session.sub);

  const user = await db.query.users.findFirst({ where: eq(users.id, session.sub), columns: { id: true, email: true, totpEnabled: true } });
  if (!user) throw new ApiError(401, "Foydalanuvchi topilmadi");
  if (user.totpEnabled) throw new ApiError(409, "Ikki bosqichli himoya allaqachon yoqilgan");

  const secret = generateTotpSecret();
  await db
    .update(users)
    .set({ totpSecretEnc: encryptTotpSecret(secret) })
    .where(and(eq(users.id, user.id), eq(users.totpEnabled, false)));
  await audit(user.id, "2fa_setup_started", { targetType: "user", targetId: user.id }, req);

  return ok({ secret, uri: otpauthUri(secret, user.email) });
});
