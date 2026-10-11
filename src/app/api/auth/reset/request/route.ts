import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { handler, ok, parseBody } from "@/lib/api";
import { resetRequestSchema } from "@/lib/validators";
import { audit } from "@/lib/security/audit";
import { passwordResetMail, sendMail } from "@/lib/security/mailer";
import { clientIp, enforceLimit, rateLimit } from "@/lib/security/rate-limit";
import { requestOrigin, trustedSiteOrigin } from "@/lib/security/request";
import { createPasswordReset } from "@/lib/security/tokens";

/**
 * Parolni tiklash so'rovi. HAR DOIM 200 — email bazada bor-yo'qligi oshkor qilinmaydi.
 * Token (sha256 hash bazada, 1 soat) email orqali yuboriladi; Resend sozlanmagan bo'lsa
 * dev rejimida havola server konsoliga chiqadi. Rate limit: 3 / soat / ip (+ 3 / soat / email).
 *
 * Havola FAQAT ishonchli manzildan tuziladi (NEXT_PUBLIC_SITE_URL / platforma domeni): productionda
 * Host / X-Forwarded-Host sarlavhalari ishlatilmaydi — aks holda hujumchi "Host" ni almashtirib
 * jabrlanuvchining tokenini o'z saytiga yo'naltira olardi (reset-link poisoning). Dev'da localhost dan.
 * Token yaratish, xat va audit javobdan KEYIN (after) bajariladi — javob vaqti ham email mavjudligini oshkor qilmaydi.
 */
export const POST = handler(async (req) => {
  await enforceLimit("reset", clientIp(req));
  const input = await parseBody(req, resetRequestSchema);
  await rateLimit(`resetEmail:${input.email}`, 3, 60 * 60 * 1000);

  const user = await db.query.users.findFirst({ where: eq(users.email, input.email), columns: { id: true, name: true, email: true } });
  if (user) {
    const base = trustedSiteOrigin() ?? (process.env.NODE_ENV !== "production" ? requestOrigin(req) : null);
    after(async () => {
      try {
        if (!base) {
          console.error("[auth] NEXT_PUBLIC_SITE_URL o'rnatilmagan — parol tiklash havolasi yuborilmadi");
          await audit(user.id, "password_reset_requested", { targetType: "user", targetId: user.id, meta: { sent: false, reason: "no_site_url" } }, req);
          return;
        }
        const { token } = await createPasswordReset(user.id);
        const result = await sendMail(passwordResetMail(user.email, user.name, `${base}/auth/parol-tiklash/${token}`));
        await audit(user.id, "password_reset_requested", { targetType: "user", targetId: user.id, meta: { sent: result.sent, reason: result.reason } }, req);
      } catch (e) {
        console.error("[auth] reset request", e);
      }
    });
  }

  return ok({ requested: true });
});
