import { and, eq, ne } from "drizzle-orm";
import { ApiError, handler, ok } from "@/lib/api";
import { createSession, getVerifiedSession } from "@/lib/auth";
import { findTelegramUser } from "@/lib/auth/telegram-login";
import { verifyWebAppInitData } from "@/lib/auth/telegram-webapp";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { audit } from "@/lib/security/audit";
import { clientIp, enforceLimit } from "@/lib/security/rate-limit";
import { isTelegramEnabled, telegramBotUsername } from "@/lib/telegram";
import { setAdminCommands } from "@/lib/telegram-bot/ui";

export const runtime = "nodejs";

/** Ichki yo'l: faqat "/..." (ochiq yo'naltirish yo'q) */
function safePath(p: unknown): string {
  if (typeof p !== "string" || !p.startsWith("/") || p.startsWith("//") || p.includes("\\")) return "/";
  return p.slice(0, 300);
}

/**
 * Telegram Mini App kirishi: `initData` imzosi bot tokeni bilan tekshiriladi.
 *  - chat hisobga ulangan (yoki eski `tg<chatId>@telegram.local` hisob) → sessiya cookie → `next`
 *  - hisob YO'Q → `{status:"register"}`: avtomatik «mijoz» hisobi OCHILMAYDI (2026-10-31) — darvoza
 *    botdagi savol-javob ro'yxatini (`/start reg`) yoki saytdagi hisob bilan kirishni taklif qiladi
 *  - `link: true` + kirgan sessiya → Telegram chati shu hisobga ulanadi («Hisobim bor — kirish» yo'li)
 */
export const POST = handler(async (req) => {
  if (!isTelegramEnabled()) throw new ApiError(503, "Telegram bot sozlanmagan");
  await enforceLimit("tgStart", clientIp(req));
  const body = (await req.json().catch(() => ({}))) as { initData?: unknown; to?: unknown; link?: unknown };
  const v = verifyWebAppInitData(typeof body.initData === "string" ? body.initData : "");
  if (!v) throw new ApiError(401, "Telegram ma'lumoti tasdiqlanmadi — ilovani botdan qayta oching");
  const chatId = String(v.user.id);
  const tgName = [v.user.first_name, v.user.last_name].filter(Boolean).join(" ");

  if (body.link === true) {
    const session = await getVerifiedSession();
    if (!session) throw new ApiError(401, "Avval saytdagi hisobingizga kiring");
    // Bitta chat — bitta hisob: boshqa hisobdan uzib, shu hisobga ulaymiz
    await db.update(users).set({ telegramChatId: null }).where(and(eq(users.telegramChatId, chatId), ne(users.id, session.sub)));
    await db.update(users).set({ telegramChatId: chatId, lastLoginAt: new Date() }).where(eq(users.id, session.sub));
    if (session.role === "admin") await setAdminCommands(chatId).catch(() => false);
    await audit(session.sub, "telegram_linked", { targetType: "user", targetId: session.sub, meta: { via: "webapp" } }, req).catch(() => undefined);
    return ok({ status: "ok", isNew: false, next: safePath(body.to) });
  }

  const r = await findTelegramUser(chatId);
  if (!r) return ok({ status: "register", bot: telegramBotUsername(), name: tgName });
  await createSession({ id: r.userId, role: r.role as "client" | "specialist" | "admin", name: r.name }, { remember: true });
  await audit(r.userId, "login_success", { targetType: "user", targetId: r.userId, meta: { provider: "telegram_webapp" } }, req).catch(() => undefined);
  return ok({ status: "ok", isNew: false, next: safePath(body.to) });
});
