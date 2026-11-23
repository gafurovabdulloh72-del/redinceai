import { eq } from "drizzle-orm";
import { ApiError, handler, ok, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { brandedMail, mailProvider, sendMail } from "@/lib/security/mailer";
import { rateLimit } from "@/lib/security/rate-limit";
import { audit } from "@/lib/security/audit";

const REASONS: Record<string, string> = {
  not_configured: "Email sozlanmagan — Vercel'da SMTP_USER va SMTP_PASS qo'yib, Redeploy qiling",
  no_address: "Hisobingizda haqiqiy email yo'q (Telegram hisobi) — Kabinet → Akkauntda emailingizni yozing",
  daily_limit: "Bugungi xat limiti tugadi (SMTP_DAILY_LIMIT)",
  smtp: "Gmail xatni qabul qilmadi — SMTP_USER/SMTP_PASS (App password) to'g'riligini tekshiring",
  network: "Email xizmatiga ulanib bo'lmadi",
};

/** Admin: o'z emailiga sinov xati — email sozlamasi ishlayotganini tekshirish (Tizim → Tayyorlik → Email) */
export const POST = handler(async (req) => {
  const session = await requireSession(["admin"]);
  await rateLimit(`mailTest:${session.sub}`, 5, 3_600_000, "Sinov xati");
  const me = await db.query.users.findFirst({ where: eq(users.id, session.sub), columns: { email: true, name: true, lang: true } });
  if (!me?.email) throw new ApiError(400, REASONS.no_address);
  const lang = me.lang === "ru" ? "ru" : "uz";
  const r = await sendMail(
    brandedMail({
      to: me.email,
      name: me.name || "Admin",
      title: lang === "ru" ? "Тестовое письмо" : "Sinov xati",
      body: lang === "ru" ? "Если вы читаете это письмо — отправка email работает." : "Bu xatni o'qiyotgan bo'lsangiz — email yuborish ishlayapti.",
      lang,
    }),
  );
  await audit(session.sub, "admin_mail_test", { meta: { sent: r.sent, reason: r.reason ?? null, detail: r.detail ?? null, provider: mailProvider() } }, req);
  if (!r.sent) {
    const base = REASONS[r.reason ?? ""] ?? `Xat yuborilmadi (${r.reason ?? "noma'lum"})`;
    throw new ApiError(502, r.detail ? `${base}. Gmail javobi: ${r.detail}` : base);
  }
  return ok({ sent: true, to: me.email.replace(/^(.).*(@.*)$/, "$1***$2") });
});
