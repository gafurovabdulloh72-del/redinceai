import { ApiError, handler, ok, requireSession } from "@/lib/api";
import { createTelegramLinkCode, isTelegramEnabled, telegramBotUsername } from "@/lib/telegram";

/**
 * Telegram botga ulash havolasi: qisqa muddatli (15 daqiqa) imzolangan kod bilan deep-link.
 * Foydalanuvchi havolani ochib botda «Start» bossa, webhook hisobga chatId yozadi.
 */
export const POST = handler(async () => {
  const session = await requireSession();
  const username = telegramBotUsername();
  if (!isTelegramEnabled() || !username) throw new ApiError(503, "Telegram bot sozlanmagan (TELEGRAM_BOT_TOKEN / TELEGRAM_BOT_USERNAME) — administratorga murojaat qiling");
  const code = createTelegramLinkCode(session.sub);
  if (!code) throw new ApiError(500, "Ulash kodini yaratib bo'lmadi. Keyinroq qayta urinib ko'ring");
  return ok({ url: `https://t.me/${username}?start=${code}` });
});
