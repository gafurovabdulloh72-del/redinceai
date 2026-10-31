import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { ApiError, handler, ok } from "@/lib/api";
import { createSession, getVerifiedSession } from "@/lib/auth";
import { cookies } from "next/headers";
import { LOCALE_COOKIE } from "@/lib/i18n";
import { createTelegramAccount, findTelegramUser } from "@/lib/auth/telegram-login";
import { verifyWebAppInitData } from "@/lib/auth/telegram-webapp";
import { CATEGORY_BY_SLUG, REGION_BY_SLUG } from "@/lib/constants";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { audit } from "@/lib/security/audit";
import { enforceLimit } from "@/lib/security/rate-limit";
import { isTelegramEnabled, telegramBotUsername } from "@/lib/telegram";
import { setAdminCommands } from "@/lib/telegram-bot/ui";
import { optionalPhone } from "@/lib/validators";

export const runtime = "nodejs";

/** Ichki yo'l: faqat "/..." (ochiq yo'naltirish yo'q) */
function safePath(p: unknown): string {
  if (typeof p !== "string" || !p.startsWith("/") || p.startsWith("//") || p.includes("\\")) return "/";
  return p.slice(0, 300);
}

/** Mini App ichidagi ro'yxat savollari (TgRegister) — botdagi savol-javob bilan bir xil maydonlar */
const registerSchema = z.object({
  role: z.enum(["client", "specialist"]),
  name: z.string().trim().min(2, "Ism kamida 2 ta belgi").max(60, "Ism 60 belgidan oshmasin"),
  phone: optionalPhone,
  category: z.string().trim().max(60).optional(),
  experience: z.enum(["junior", "middle", "senior", "expert"]).optional(),
  region: z.string().trim().max(40).optional(),
});

/**
 * Telegram Mini App kirishi: `initData` imzosi bot tokeni bilan tekshiriladi.
 *  - chat hisobga ulangan (yoki eski `tg<chatId>@telegram.local` hisob) → sessiya cookie → `next`
 *  - hisob YO'Q → `{status:"register"}`: avtomatik hisob OCHILMAYDI (2026-10-31) — ilova «akkauntingiz bormi?» so'raydi
 *  - `register: {...}` → savollarga javob berilgan: hisob yaratiladi (`createTelegramAccount`) → sessiya → /xush-kelibsiz
 *  - `link: true` + kirgan sessiya → Telegram chati shu hisobga ulanadi («Ha, akkauntim bor» yo'li); sessiya yo'q → 401
 */
/** Telegram tili ruscha bo'lsa sayt tilini `ru` qilamiz — faqat foydalanuvchi hali til tanlamagan bo'lsa (cookie yo'q) */
async function applyTelegramLocale(code: string | undefined): Promise<void> {
  if (!code || !code.toLowerCase().startsWith("ru")) return;
  const jar = await cookies();
  if (jar.get(LOCALE_COOKIE)) return;
  jar.set(LOCALE_COOKIE, "ru", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}

export const POST = handler(async (req) => {
  if (!isTelegramEnabled()) throw new ApiError(503, "Telegram bot sozlanmagan");
  const body = (await req.json().catch(() => ({}))) as { initData?: unknown; to?: unknown; link?: unknown; register?: unknown };
  const v = verifyWebAppInitData(typeof body.initData === "string" ? body.initData : "");
  if (!v) throw new ApiError(401, "Telegram ma'lumoti tasdiqlanmadi — ilovani botdan qayta oching");
  const chatId = String(v.user.id);
  // Chegara imzo tekshiruvidan KEYIN va Telegram user id bo'yicha: bitta mobil operator IP'si ortida minglab foydalanuvchi bo'ladi
  await enforceLimit("tgApp", `tg:${chatId}`);
  const tgName = [v.user.first_name, v.user.last_name].filter(Boolean).join(" ");
  await applyTelegramLocale(v.user.language_code);

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

  if (body.register !== undefined) {
    const parsed = registerSchema.safeParse(body.register);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const i of parsed.error.issues) fields[String(i.path[0] ?? "form")] = i.message;
      throw new ApiError(422, "Ma'lumotlarni tekshiring", fields);
    }
    const d = parsed.data;
    if (d.role === "specialist") {
      if (!d.category || !CATEGORY_BY_SLUG[d.category]) throw new ApiError(422, "Kasbingizni tanlang", { category: "Kasbni tanlang" });
      if (!d.region || !REGION_BY_SLUG[d.region]) throw new ApiError(422, "Hududni tanlang", { region: "Hududni tanlang" });
    }
    const r = await createTelegramAccount(chatId, {
      name: d.name,
      username: v.user.username ?? null,
      role: d.role,
      phone: d.phone || null,
      specialist: d.role === "specialist" && d.category && d.region ? { category: d.category, experience: d.experience ?? "middle", regionSlug: d.region } : null,
    });
    await createSession({ id: r.userId, role: r.role as "client" | "specialist" | "admin", name: r.name }, { remember: true });
    await audit(r.userId, r.isNew ? "register" : "login_success", { targetType: "user", targetId: r.userId, meta: { provider: "telegram_webapp", role: d.role } }, req).catch(() => undefined);
    return ok({ status: "ok", isNew: r.isNew, next: r.isNew ? "/xush-kelibsiz" : safePath(body.to) });
  }

  const r = await findTelegramUser(chatId);
  if (!r) return ok({ status: "register", bot: telegramBotUsername(), name: tgName });
  await createSession({ id: r.userId, role: r.role as "client" | "specialist" | "admin", name: r.name }, { remember: true });
  await audit(r.userId, "login_success", { targetType: "user", targetId: r.userId, meta: { provider: "telegram_webapp" } }, req).catch(() => undefined);
  return ok({ status: "ok", isNew: false, next: safePath(body.to) });
});
