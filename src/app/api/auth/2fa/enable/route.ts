import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { notify } from "@/lib/notifications";
import { audit } from "@/lib/security/audit";
import { enforceLimit } from "@/lib/security/rate-limit";
import { decryptTotpSecret, generateRecoveryCodes, hashRecoveryCode, verifyTotpOnce } from "@/lib/security/totp";

const schema = z.object({ code: z.string().trim().regex(/^\d{6}$/, "Ilovadagi 6 xonali kodni kiriting") });

/**
 * 2FA'ni yoqish: ilovadagi kod tekshiriladi (±1 qadam, takroriy ishlatish bloklanadi), so'ng 10 ta bir martalik
 * zaxira kodi qaytariladi (bazada faqat sha256). Kodlar FAQAT shu javobda ko'rsatiladi. Rate limit: 10 / 15 daqiqa.
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  await enforceLimit("twoFactorUser", session.sub);
  const input = await parseBody(req, schema);

  const user = await db.query.users.findFirst({ where: eq(users.id, session.sub), columns: { id: true, totpEnabled: true, totpSecretEnc: true } });
  if (!user) throw new ApiError(401, "Foydalanuvchi topilmadi");
  if (user.totpEnabled) throw new ApiError(409, "Ikki bosqichli himoya allaqachon yoqilgan");
  const secret = decryptTotpSecret(user.totpSecretEnc);
  if (!secret) throw new ApiError(400, "Sozlash topilmadi. «Yoqish» tugmasini qaytadan bosing");

  if (!(await verifyTotpOnce(user.id, secret, input.code))) {
    throw new ApiError(422, "Kod noto'g'ri yoki eskirgan", { code: "Kod noto'g'ri. Ilovadagi joriy kodni kiriting (telefon soati to'g'riligini tekshiring)" });
  }

  const codes = generateRecoveryCodes();
  const res = await db
    .update(users)
    .set({ totpEnabled: true, recoveryCodes: codes.map(hashRecoveryCode) })
    .where(and(eq(users.id, user.id), eq(users.totpEnabled, false)));
  if (res.rowsAffected === 0) throw new ApiError(409, "Ikki bosqichli himoya allaqachon yoqilgan");

  await audit(user.id, "2fa_enabled", { targetType: "user", targetId: user.id }, req);
  await notify(user.id, "account", "Ikki bosqichli himoya yoqildi", "Endi kirishda paroldan tashqari autentifikator ilovasidagi kod so'raladi. Zaxira kodlarini xavfsiz joyda saqlang.", "/kabinet/xavfsizlik");
  return ok({ enabled: true, recoveryCodes: codes });
});
