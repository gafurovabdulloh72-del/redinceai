import { cookies } from "next/headers";
import { ApiError, handler, ok } from "@/lib/api";
import { clientIp, enforceLimit } from "@/lib/security/rate-limit";
import { eq } from "drizzle-orm";
import { createSession, createTwoFactorTicket, getVerifiedSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { audit } from "@/lib/security/audit";
import { describeUserAgent } from "@/lib/security/device";
import { consumeTelegramLogin, isTelegramLoginEnabled, startTelegramLogin, TG_LOGIN_COOKIE } from "@/lib/auth/telegram-login";

export const runtime = "nodejs";

const IS_PROD = process.env.NODE_ENV === "production";

/** GET — «Telegram bilan kirish» yoqilganmi (tugmani ko'rsatish uchun) */
export const GET = handler(async () => ok({ enabled: isTelegramLoginEnabled() }));

/** POST — yangi kirish so'rovi: 6 xonali kod + bot havolasi (sir cookie'ga yoziladi) */
export const POST = handler(async (req) => {
  if (!isTelegramLoginEnabled()) throw new ApiError(503, "Telegram bilan kirish sozlanmagan");
  await enforceLimit("tgLogin", clientIp(req));
  // Qurilma (brauzer · OS) botdagi tasdiq xabarida ko'rsatiladi — begona kodni tasdiqlab yuborishning oldini olish uchun
  const r = await startTelegramLogin(describeUserAgent(req.headers.get("user-agent")).label);
  const jar = await cookies();
  jar.set(TG_LOGIN_COOKIE, r.secret, { httpOnly: true, sameSite: "lax", secure: IS_PROD, path: "/", maxAge: 360 });
  return ok({ code: r.code, link: r.link, expiresAt: r.expiresAt });
});

/**
 * PUT — holatni so'rash (klient har 2 s chaqiradi). Bot tasdiqlagach `status: "confirm"` va
 * Telegram hisobining nomi qaytadi — sessiya HALI ochilmaydi. Foydalanuvchi «Kirish» bosgach
 * klient `?tasdiq=1` bilan qayta chaqiradi va sessiya shunda ochiladi (auditning 5-bandi).
 * Faqat mehmon uchun: kirgan foydalanuvchi Telegramni Kabinet → Profil orqali bog'laydi.
 */
export const PUT = handler(async (req) => {
  if (await getVerifiedSession()) throw new ApiError(409, "Siz allaqachon kirgansiz");
  await enforceLimit("tgLoginPoll", clientIp(req));
  const jar = await cookies();
  const secret = jar.get(TG_LOGIN_COOKIE)?.value ?? "";
  const confirm = new URL(req.url).searchParams.get("tasdiq") === "1";
  const r = await consumeTelegramLogin(secret, { confirm });
  if (r.status === "confirm") return ok({ status: "confirm", telegram: r.telegram });
  if (r.status !== "ok") return ok({ status: r.status });
  jar.delete(TG_LOGIN_COOKIE);
  // 2FA yoqilgan hisob: Telegram tasdig'i faqat birinchi bosqich — TOTP so'raladi (Google bilan bir xil, 3-audit)
  const tf = await db.query.users.findFirst({ where: eq(users.id, r.userId), columns: { totpEnabled: true, sessionVersion: true } });
  if (tf?.totpEnabled) {
    const ticket = await createTwoFactorTicket({ id: r.userId, sessionVersion: tf.sessionVersion }, true);
    return ok({ status: "2fa", ticket });
  }
  await createSession({ id: r.userId, role: r.role as "client" | "specialist" | "admin", name: r.name }, { remember: true });
  await audit(r.userId, r.isNew ? "register" : "login_success", { targetType: "user", targetId: r.userId, meta: { provider: "telegram" } }, req).catch(() => undefined);
  return ok({ status: "ok", isNew: r.isNew, next: r.isNew ? "/xush-kelibsiz" : "/kabinet" });
});
