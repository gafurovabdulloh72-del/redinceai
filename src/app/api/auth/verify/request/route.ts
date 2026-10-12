import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { ApiError, handler, ok, requireSession } from "@/lib/api";
import { audit } from "@/lib/security/audit";
import { emailVerifyMail, sendMail } from "@/lib/security/mailer";
import { enforceLimit } from "@/lib/security/rate-limit";
import { VERIFY_CODE_TTL_MS, createEmailVerification } from "@/lib/security/verify";

/**
 * Email tasdiqlash kodini yuborish (6 xonali, 15 daqiqa). Bazada faqat sha256(kod+userId) saqlanadi
 * (password_resets, purpose = verify_email). Resend sozlanmagan bo'lsa dev'da kod server konsoliga chiqadi.
 * Rate limit: 5 / soat / foydalanuvchi.
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  await enforceLimit("verifyRequest", session.sub);

  const user = await db.query.users.findFirst({ where: eq(users.id, session.sub), columns: { id: true, name: true, email: true, emailVerified: true } });
  if (!user) throw new ApiError(401, "Foydalanuvchi topilmadi");
  if (user.emailVerified) throw new ApiError(409, "Email allaqachon tasdiqlangan");

  const { code, expiresAt } = await createEmailVerification(user.id);
  const result = await sendMail(emailVerifyMail(user.email, user.name, code));
  await audit(user.id, "email_verify_requested", { targetType: "user", targetId: user.id, meta: { sent: result.sent, reason: result.reason } }, req);

  return ok({ requested: true, sent: result.sent, email: user.email, expiresAt: expiresAt.getTime(), ttlSec: Math.round(VERIFY_CODE_TTL_MS / 1000) });
});
