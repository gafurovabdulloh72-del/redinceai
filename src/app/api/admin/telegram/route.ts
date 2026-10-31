import { handler, ok, requireSession, ApiError } from "@/lib/api";
import { SITE_URL } from "@/lib/site-url";
import { isTelegramEnabled, telegramApi, telegramBotUsername, telegramWebhookSecret } from "@/lib/telegram";
import { audit } from "@/lib/security/audit";
import { setupBotProfile } from "@/lib/telegram-bot/ui";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, isNotNull, sql } from "drizzle-orm";
import { sendTelegram } from "@/lib/telegram";

/**
 * Admin: Telegram bot holati va webhook'ni bir tugmada o'rnatish.
 * Foydalanuvchi Vercel'ga faqat TELEGRAM_BOT_TOKEN (+ USERNAME) qo'yadi — sir avtomatik,
 * webhook'ni esa server o'zi api.telegram.org orqali o'rnatadi (qo'lda curl shart emas).
 */

interface TgMe {
  username?: string;
  first_name?: string;
  /** BotFather /setinline yoqilganmi — inline rejim (`@bot so'z`) shunga bog'liq */
  supports_inline_queries?: boolean;
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
  // Ulangan hisoblar: umumiy va adminlar (admin boti kimga yozishini ko'rsatish uchun)
  const [linked] = await db
    .select({ total: sql<number>`count(*)`, admins: sql<number>`sum(case when ${users.role} = 'admin' then 1 else 0 end)` })
    .from(users)
    .where(isNotNull(users.telegramChatId));
  return {
    tokenSet,
    tokenValid: Boolean(me?.ok),
    inlineEnabled: me?.ok ? Boolean(me.result?.supports_inline_queries) : null,
    linkedUsers: Number(linked?.total ?? 0),
    adminChats: Number(linked?.admins ?? 0),
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
    // callback_query — inline tugmalar; pre_checkout_query — Telegram ichidagi to'lov
    allowed_updates: ["message", "callback_query", "pre_checkout_query", "inline_query"],
  });
  if (!res) throw new ApiError(502, "Telegram API'ga ulanib bo'lmadi — birozdan so'ng qayta urinib ko'ring");
  if (!res.ok) throw new ApiError(502, `Telegram rad etdi: ${res.description ?? "noma'lum xato"}`);
  await audit(session.sub, "admin_settings", { meta: { action: "telegram_webhook_set", url } }, req);
  return ok(await status());
});

/** Bot profilini bezash: nom, tavsiflar, buyruqlar menyusi, menyu tugmasi (lib/telegram-bot/ui.ts matnlari) */
export const PUT = handler(async (req) => {
  const session = await requireSession(["admin"]);
  if (!isTelegramEnabled()) throw new ApiError(503, "TELEGRAM_BOT_TOKEN sozlanmagan");
  const res = await setupBotProfile();
  await audit(session.sub, "admin_settings", { meta: { action: "telegram_profile_set", errors: res.errors.length } }, req);
  return ok(res);
});

/** Sinov xabari: shu adminning ulangan chatiga «bot ishlayapti» — bildirishnoma yo'li tekshiriladi */
export const PATCH = handler(async (req) => {
  const session = await requireSession(["admin"]);
  if (!isTelegramEnabled()) throw new ApiError(503, "TELEGRAM_BOT_TOKEN sozlanmagan");
  const me = await db.query.users.findFirst({ where: eq(users.id, session.sub), columns: { telegramChatId: true, name: true } });
  if (!me?.telegramChatId) throw new ApiError(400, "Sizning hisobingiz Telegramga ulanmagan — Kabinet → Profil → «Telegramga ulash»");
  const sent = await sendTelegram(me.telegramChatId, `✅ <b>Bot ishlayapti</b> — sinov xabari (${new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent" })}).\nAdmin buyruqlari: /admin · /stat · /navbat · /tolovlar · /user · /elon`, {
    keyboard: [[{ text: "📊 Statistika", data: "adm:stat:today" }, { text: "📥 Navbat", data: "adm:queue" }]],
  });
  if (!sent) throw new ApiError(502, "Telegram xabarni qabul qilmadi — token yoki chat holatini tekshiring");
  await audit(session.sub, "admin_settings", { meta: { action: "telegram_test_message" } }, req);
  return ok({ sent: true });
});
