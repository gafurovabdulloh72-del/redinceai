import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { audit } from "@/lib/security/audit";
import { enforceLimit } from "@/lib/security/rate-limit";
import { decryptTotpSecret, generateRecoveryCodes, hashRecoveryCode, verifyTotpOnce } from "@/lib/security/totp";

const schema = z.object({ code: z.string().trim().regex(/^\d{6}$/, "Ilovadagi 6 xonali kodni kiriting") });

/** Zaxira kodlarini yangilash (eskilari bekor bo'ladi). Ilovadagi joriy kod majburiy. Rate limit: 10 / soat. */
export const POST = handler(async (req) => {
  const session = await requireSession();
  await enforceLimit("twoFactorSetup", session.sub);
  const input = await parseBody(req, schema);

  const user = await db.query.users.findFirst({ where: eq(users.id, session.sub), columns: { id: true, totpEnabled: true, totpSecretEnc: true } });
  if (!user) throw new ApiError(401, "Foydalanuvchi topilmadi");
  if (!user.totpEnabled) throw new ApiError(409, "Ikki bosqichli himoya yoqilmagan");
  const secret = decryptTotpSecret(user.totpSecretEnc);
  if (!secret || !(await verifyTotpOnce(user.id, secret, input.code))) {
    throw new ApiError(422, "Kod noto'g'ri yoki eskirgan", { code: "Kod noto'g'ri yoki eskirgan" });
  }

  const codes = generateRecoveryCodes();
  await db
    .update(users)
    .set({ recoveryCodes: codes.map(hashRecoveryCode) })
    .where(and(eq(users.id, user.id), eq(users.totpEnabled, true)));
  await audit(user.id, "2fa_recovery_regenerated", { targetType: "user", targetId: user.id }, req);
  return ok({ recoveryCodes: codes });
});
