import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createSession } from "@/lib/auth";
import { ApiError, handler, ok, parseBody } from "@/lib/api";
import { loginSchema } from "@/lib/validators";
import { audit } from "@/lib/security/audit";
import { verifyAgainstDummy, verifyPassword } from "@/lib/security/password";
import { RATE_LIMITS, assertUnderLimit, clearLimit, clientIp, rateLimit } from "@/lib/security/rate-limit";

const schema = loginSchema.extend({ remember: z.boolean().optional().default(true) });

/**
 * Kirish. Xato xabari umumiy ("Email yoki parol noto'g'ri") — email mavjudligi oshkor qilinmaydi,
 * foydalanuvchi topilmasa ham bcrypt ishlaydi (javob vaqti bir xil).
 * Rate limit: ip+email bo'yicha 5 ta muvaffaqiyatsiz urinish / 15 daqiqa, ip bo'yicha 20 / 15 daqiqa.
 */
export const POST = handler(async (req) => {
  const input = await parseBody(req, schema);
  const ip = clientIp(req);
  const keyPair = `login:${ip}:${input.email}`;
  const keyIp = `loginIp:${ip}`;

  await assertUnderLimit(keyPair, RATE_LIMITS.login.limit);
  await assertUnderLimit(keyIp, RATE_LIMITS.loginIp.limit);

  const user = await db.query.users.findFirst({ where: eq(users.email, input.email) });
  const valid = user ? await verifyPassword(input.password, user.passwordHash) : await verifyAgainstDummy(input.password);

  if (!user || !valid) {
    await Promise.all([
      rateLimit(keyPair, RATE_LIMITS.login.limit, RATE_LIMITS.login.windowMs).catch(() => undefined),
      rateLimit(keyIp, RATE_LIMITS.loginIp.limit, RATE_LIMITS.loginIp.windowMs).catch(() => undefined),
      audit(user?.id ?? null, "login_failed", { targetType: "user", targetId: user?.id, meta: { email: input.email } }, req),
    ]);
    throw new ApiError(401, "Email yoki parol noto'g'ri");
  }

  await Promise.all([
    clearLimit(keyPair),
    db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id)),
    audit(user.id, "login_success", { targetType: "user", targetId: user.id, meta: { remember: input.remember } }, req),
  ]);
  await createSession(user, { remember: input.remember });
  return ok({ id: user.id, name: user.name, role: user.role });
});
