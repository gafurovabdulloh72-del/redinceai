import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createSession, verifyTwoFactorTicket } from "@/lib/auth";
import { ApiError, handler, ok, parseBody } from "@/lib/api";
import { audit } from "@/lib/security/audit";
import { RATE_LIMITS, assertUnderLimit, clearLimit, clientIp, enforceLimit, isConsumed, rateLimit, tryConsume } from "@/lib/security/rate-limit";
import { consumeSecondFactor, secondFactorCode } from "@/lib/security/two-factor";

const schema = z
  .object({
    ticket: z.string().min(20).max(2000),
    code: secondFactorCode.optional(),
    recoveryCode: secondFactorCode.optional(),
  })
  .refine((v) => Boolean(v.code || v.recoveryCode), { message: "Kodni kiriting", path: ["code"] });

const EXPIRED = "Kirish muddati tugadi. Email va parolni qaytadan kiriting";

/**
 * Kirishning ikkinchi bosqichi: parol bosqichidagi 5 daqiqalik chipta + ilovadagi kod (yoki zaxira kodi).
 * Rate limit: chipta + IP bo'yicha 5 urinish / 15 daqiqa; foydalanuvchi bo'yicha 10 muvaffaqiyatsiz kod / 15 daqiqa
 * (yangi chipta olib terib chiqib bo'lmasin). Chipta bir martalik.
 */
export const POST = handler(async (req) => {
  const input = await parseBody(req, schema);
  const ip = clientIp(req);

  const ticket = await verifyTwoFactorTicket(input.ticket);
  if (!ticket) throw new ApiError(401, EXPIRED);
  const usedKey = `ticketUsed:${ticket.jti}`;
  // Ishlatilgan chipta bilan kod (ayniqsa zaxira kodi) behuda sarflanmasin
  if (await isConsumed(usedKey)) throw new ApiError(401, EXPIRED);
  await enforceLimit("twoFactorVerify", `${ticket.jti}:${ip}`);
  const userKey = `twoFactorUser:${ticket.sub}`;
  await assertUnderLimit(userKey, RATE_LIMITS.twoFactorUser.limit);

  const user = await db.query.users.findFirst({ where: eq(users.id, ticket.sub) });
  if (!user || user.isBanned || user.sessionVersion !== ticket.sv || !user.totpEnabled) throw new ApiError(401, EXPIRED);

  const field = input.recoveryCode ? "recoveryCode" : "code";
  const kind = await consumeSecondFactor(user, input.recoveryCode ?? input.code ?? "");
  if (!kind) {
    await Promise.all([
      rateLimit(userKey, RATE_LIMITS.twoFactorUser.limit, RATE_LIMITS.twoFactorUser.windowMs).catch(() => undefined),
      audit(user.id, "login_2fa_failed", { targetType: "user", targetId: user.id, meta: { via: field } }, req),
    ]);
    throw new ApiError(422, "Kod noto'g'ri yoki eskirgan", { [field]: field === "code" ? "Kod noto'g'ri. Ilovadagi joriy kodni kiriting" : "Zaxira kodi noto'g'ri yoki ishlatilgan" });
  }
  // Chipta bir martalik (parallel so'rovlardan faqat bittasi sessiya oladi)
  if (!(await tryConsume(usedKey, 10 * 60 * 1000))) throw new ApiError(401, EXPIRED);

  await Promise.all([
    clearLimit(`login:${ip}:${user.email}`),
    clearLimit(`loginEmail:${user.email}`),
    clearLimit(userKey),
    db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id)),
    audit(user.id, "login_success", { targetType: "user", targetId: user.id, meta: { remember: ticket.remember, twoFactor: kind } }, req),
  ]);
  await createSession(user, { remember: ticket.remember, embedded: ticket.embedded });
  const recoveryLeft = kind === "recovery" ? Math.max(0, user.recoveryCodes.length - 1) : null;
  return ok({ id: user.id, name: user.name, role: user.role, recoveryLeft });
});
