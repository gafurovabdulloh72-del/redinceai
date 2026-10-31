import { ApiError, handler, ok } from "@/lib/api";
import { createSession } from "@/lib/auth";
import { findOrCreateTelegramUser } from "@/lib/auth/telegram-login";
import { verifyWebAppInitData } from "@/lib/auth/telegram-webapp";
import { audit } from "@/lib/security/audit";
import { clientIp, enforceLimit } from "@/lib/security/rate-limit";
import { isTelegramEnabled } from "@/lib/telegram";

export const runtime = "nodejs";

/** Ichki yo'l: faqat "/..." (ochiq yo'naltirish yo'q) */
function safePath(p: unknown): string {
  if (typeof p !== "string" || !p.startsWith("/") || p.startsWith("//") || p.includes("\\")) return "/";
  return p.slice(0, 300);
}

/**
 * Telegram Mini App kirishi: `initData` imzosi bot tokeni bilan tekshiriladi, Telegram foydalanuvchisi
 * hisobga bog'lanadi (yo'q bo'lsa yaratiladi — «Telegram bilan kirish» bilan bir xil qoidalar) va
 * sessiya cookie ochiladi. Telegram tasdiqlagan ma'lumot bo'lgani uchun alohida «Bu menman» qadami shart emas.
 */
export const POST = handler(async (req) => {
  if (!isTelegramEnabled()) throw new ApiError(503, "Telegram bot sozlanmagan");
  await enforceLimit("tgStart", clientIp(req));
  const body = (await req.json().catch(() => ({}))) as { initData?: unknown; to?: unknown };
  const v = verifyWebAppInitData(typeof body.initData === "string" ? body.initData : "");
  if (!v) throw new ApiError(401, "Telegram ma'lumoti tasdiqlanmadi — ilovani botdan qayta oching");
  const r = await findOrCreateTelegramUser(String(v.user.id), { name: [v.user.first_name, v.user.last_name].filter(Boolean).join(" "), username: v.user.username ?? null });
  await createSession({ id: r.userId, role: r.role as "client" | "specialist" | "admin", name: r.name }, { remember: true });
  await audit(r.userId, r.isNew ? "register" : "login_success", { targetType: "user", targetId: r.userId, meta: { provider: "telegram_webapp" } }, req).catch(() => undefined);
  return ok({ isNew: r.isNew, next: r.isNew ? "/xush-kelibsiz" : safePath(body.to) });
});
