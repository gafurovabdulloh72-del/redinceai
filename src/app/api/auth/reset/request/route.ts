import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { handler, ok, parseBody } from "@/lib/api";
import { resetRequestSchema } from "@/lib/validators";
import { audit } from "@/lib/security/audit";
import { passwordResetMail, sendMail } from "@/lib/security/mailer";
import { clientIp, enforceLimit, rateLimit } from "@/lib/security/rate-limit";
import { requestOrigin } from "@/lib/security/request";
import { createPasswordReset } from "@/lib/security/tokens";

/**
 * Parolni tiklash so'rovi. HAR DOIM 200 — email bazada bor-yo'qligi oshkor qilinmaydi.
 * Token (sha256 hash bazada, 1 soat) email orqali yuboriladi; Resend sozlanmagan bo'lsa
 * dev rejimida havola server konsoliga chiqadi. Rate limit: 3 / soat / ip (+ 3 / soat / email).
 */
export const POST = handler(async (req) => {
  await enforceLimit("reset", clientIp(req));
  const input = await parseBody(req, resetRequestSchema);
  await rateLimit(`resetEmail:${input.email}`, 3, 60 * 60 * 1000);

  const user = await db.query.users.findFirst({ where: eq(users.email, input.email), columns: { id: true, name: true, email: true } });
  if (user) {
    const { token } = await createPasswordReset(user.id);
    const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || requestOrigin(req);
    const link = `${base}/auth/parol-tiklash/${token}`;
    const result = await sendMail(passwordResetMail(user.email, user.name, link));
    await audit(user.id, "password_reset_requested", { targetType: "user", targetId: user.id, meta: { sent: result.sent, reason: result.reason } }, req);
  }

  return ok({ requested: true });
});
