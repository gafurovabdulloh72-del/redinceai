import { handler, ok, requireSession, ApiError } from "@/lib/api";
import { SITE_URL } from "@/lib/site-url";
import { isTelegramEnabled, telegramApi, telegramBotUsername, telegramWebhookSecret } from "@/lib/telegram";
import { audit } from "@/lib/security/audit";

/**
 * Admin: Telegram bot holati va webhook'ni bir tugmada o'rnatish.
 * Foydalanuvchi Vercel'ga faqat TELEGRAM_BOT_TOKEN (+ USERNAME) qo'yadi — sir avtomatik,
 * webhook'ni esa server o'zi api.telegram.org orqali o'rnatadi (qo'lda curl shart emas).
 */

interface TgMe {
  username?: string;
  first_name?: string;
}
interface TgWebhookInfo {
  url?: string;
  pending_update_count?: number;
  last_error_message?: string;
  last_error_date?: number;
}

function expectedWebhookUrl(): string {
  return `${SITE_URL.replace(/\/$/, "")}/api/telegram/webhook`;
}

async function status() {
  const tokenSet = isTelegramEnabled();
  const [me, info] = tokenSet ? await Promise.all([telegramApi<TgMe>("getMe"), telegramApi<TgWebhookInfo>("getWebhookInfo")]) : [null, null];
  return {
    tokenSet,
    tokenValid: Boolean(me?.ok),
    botUsername: me?.ok ? (me.result?.username ?? null) : null,
    usernameEnv: telegramBotUsername(),
    expectedUrl: expectedWebhookUrl(),
    webhookUrl: info?.ok ? (info.result?.url ?? "") : null,
    webhookOk: Boolean(info?.ok && info.result?.url === expectedWebhookUrl()),
    pendingUpdates: info?.ok ? (info.result?.pending_update_count ?? 0) : null,
    lastError: info?.ok ? (info.result?.last_error_message ?? null) : (info?.description ?? null),
    secretSource: process.env.TELEGRAM_WEBHOOK_SECRET ? ("env" as const) : ("auto" as const),
  };
}

/** Holat: token/username to'g'riligi, webhook qayerga qarab turgani, oxirgi xato */
export const GET = handler(async () => {
  await requireSession(["admin"]);
  return ok(await status());
});

/** Webhook'ni o'rnatish/yangilash — server o'zi setWebhook chaqiradi */
export const POST = handler(async (req) => {
  const session = await requireSession(["admin"]);
  if (!isTelegramEnabled()) throw new ApiError(503, "TELEGRAM_BOT_TOKEN sozlanmagan — avval Vercel'ga token qo'yib redeploy qiling");
  const url = expectedWebhookUrl();
  if (url.startsWith("http://") && process.env.NODE_ENV === "production") {
    throw new ApiError(500, "Sayt manzili aniqlanmadi (NEXT_PUBLIC_SITE_URL) — webhook faqat https manzilga o'rnatiladi");
  }
  const res = await telegramApi("setWebhook", {
    url,
    secret_token: telegramWebhookSecret(),
    // callback_query — qo'lda o'tkazmani Telegramdan bir bosishda tasdiqlash tugmalari uchun
    allowed_updates: ["message", "callback_query"],
  });
  if (!res) throw new ApiError(502, "Telegram API'ga ulanib bo'lmadi — birozdan so'ng qayta urinib ko'ring");
  if (!res.ok) throw new ApiError(502, `Telegram rad etdi: ${res.description ?? "noma'lum xato"}`);
  await audit(session.sub, "admin_settings", { meta: { action: "telegram_webhook_set", url } }, req);
  return ok(await status());
});
