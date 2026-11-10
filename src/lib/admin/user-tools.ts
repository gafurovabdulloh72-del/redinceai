import "server-only";
import { eq } from "drizzle-orm";
import { bumpSessionVersion } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { passwordResetMail, sendMail } from "@/lib/security/mailer";
import { listUserSessions, revokeUserSession, type SessionListItem } from "@/lib/security/sessions";
import { createPasswordReset, invalidatePasswordResets } from "@/lib/security/tokens";
import { isTelegramEnabled, sendTelegram } from "@/lib/telegram";

/**
 * ADMIN: FOYDALANUVCHI XAVFSIZLIK VOSITALARI (2026-11-10) — «hisobim o'g'irlandi / kira olmayapman» murojaatlari uchun.
 *  · faol sessiyalar (qurilma, oxirgi faollik) — mavjud `listUserSessions` (xom IP/user-agent chiqmaydi);
 *  · barcha sessiyalarni tugatish — mavjud `bumpSessionVersion` (sessiya versiyasi +1, barcha JWT bekor);
 *  · parol tiklash havolasi — mavjud tiklash oqimi (1 soatlik bir martalik token), havola FAQAT foydalanuvchining o'z
 *    emaili/Telegramiga ketadi: admin ham, javob ham tokenni ko'rmaydi (o'g'irlangan admin sessiyasi hisobni egallay olmaydi).
 */
export interface AdminUserSecurity {
  user: {
    id: string;
    name: string;
    email: string;
    role: "client" | "specialist" | "admin";
    isBanned: boolean;
    lastLoginAt: number | null;
    passwordChangedAt: number | null;
    totpEnabled: boolean;
    emailVerified: boolean;
    telegramLinked: boolean;
    googleLinked: boolean;
    /** Email haqiqiy emasmi (Telegram orqali ochilgan hisob: `tg…@telegram.local` — xat bormaydi) */
    placeholderEmail: boolean;
  };
  sessions: SessionListItem[];
}

const isPlaceholderEmail = (email: string) => /@telegram\.local$/i.test(email);

export async function adminUserSecurity(userId: string, viewer: { sub: string; jti?: string; iat?: number }): Promise<AdminUserSecurity | null> {
  const u = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, name: true, email: true, role: true, isBanned: true, lastLoginAt: true, passwordChangedAt: true, totpEnabled: true, emailVerified: true, telegramChatId: true, googleId: true },
  });
  if (!u) return null;
  // Admin o'z qatoriga qarayotgan bo'lsa «shu qurilma» belgilanadi (uni bu yerdan yopib bo'lmaydi)
  const sessions = await listUserSessions(u.id, viewer.sub === u.id ? viewer : null);
  return {
    user: {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isBanned: u.isBanned,
      lastLoginAt: u.lastLoginAt?.getTime() ?? null,
      passwordChangedAt: u.passwordChangedAt?.getTime() ?? null,
      totpEnabled: u.totpEnabled,
      emailVerified: u.emailVerified,
      telegramLinked: Boolean(u.telegramChatId),
      googleLinked: Boolean(u.googleId),
      placeholderEmail: isPlaceholderEmail(u.email),
    },
    sessions,
  };
}

/** Barcha sessiyalarni tugatish: sessiya versiyasi oshadi — eski cookie'lar hech qaysi qurilmada ishlamaydi */
export async function adminRevokeAllSessions(userId: string): Promise<void> {
  await bumpSessionVersion(userId);
}

/** Bitta sessiyani (qurilmani) yopish. false — topilmadi yoki allaqachon yopilgan */
export async function adminRevokeSession(userId: string, sessionId: string): Promise<boolean> {
  return revokeUserSession(userId, sessionId);
}

export type ResetChannel = "email" | "telegram";

/**
 * Parol tiklash havolasini foydalanuvchining O'Z kanaliga yuborish. Tartib: haqiqiy email → (bo'lmasa yoki yuborilmasa)
 * ulangan Telegram. Hech biriga yetmasa — yaratilgan token darhol bekor qilinadi. Token hech qachon qaytarilmaydi.
 */
export async function adminSendPasswordReset(userId: string, base: string): Promise<{ sent: boolean; channel: ResetChannel | null; reason?: string }> {
  const u = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { id: true, name: true, email: true, lang: true, telegramChatId: true } });
  if (!u) return { sent: false, channel: null, reason: "not_found" };
  const { token } = await createPasswordReset(u.id);
  const link = `${base}/auth/parol-tiklash/${token}`;
  let reason: string | undefined;

  if (!isPlaceholderEmail(u.email)) {
    const res = await sendMail(passwordResetMail(u.email, u.name, link, u.lang ?? "uz"));
    if (res.sent) return { sent: true, channel: "email" };
    reason = res.reason;
  } else reason = "no_real_email";

  if (u.telegramChatId && isTelegramEnabled()) {
    const ru = u.lang === "ru";
    const ok = await sendTelegram(
      u.telegramChatId,
      ru
        ? "🔑 <b>Установка нового пароля</b>\nАдминистрация отправила вам ссылку для установки пароля на сайте. Ссылка действует 1 час и срабатывает один раз.\n\n⚠️ Если вы не обращались в поддержку — не нажимайте кнопку."
        : "🔑 <b>Yangi parol o'rnatish</b>\nAdministratsiya saytdagi hisobingiz uchun parol o'rnatish havolasini yubordi. Havola 1 soat amal qiladi va bir marta ishlaydi.\n\n⚠️ Qo'llab-quvvatlashga murojaat qilmagan bo'lsangiz — tugmani bosmang.",
      { button: { text: ru ? "🔑 Установить пароль" : "🔑 Yangi parol o'rnatish", url: link } },
    );
    if (ok) return { sent: true, channel: "telegram" };
    reason = reason ? `${reason}+telegram_failed` : "telegram_failed";
  }

  // Hech kimga yetmagan token ochiq qolmasin. Istisno — lokal ishlab chiqish: email sozlanmaganda xat server konsoliga
  // chiqadi (sendMail) va dasturchi shu havoladan foydalanadi
  if (process.env.NODE_ENV === "production" || reason !== "not_configured") await invalidatePasswordResets(u.id);
  return { sent: false, channel: null, reason };
}
