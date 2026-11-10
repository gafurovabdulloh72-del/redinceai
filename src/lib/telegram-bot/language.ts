import "server-only";
import { sendTelegram, telegramApi, type TelegramButton } from "@/lib/telegram";
import { L, type BotLang } from "@/lib/telegram-bot/lang";
import { saveLang } from "@/lib/telegram-bot/lang-store";
import { applyChatLanguage, menuRows } from "@/lib/telegram-bot/ui";

/**
 * `/til` — BOT TILINI TANLASH (2026-11-10): o'zbekcha / ruscha. Tanlov hisobda saqlanadi (`users.lang`) — bot javoblari,
 * Telegram bildirishnomalari, email va sayt shu tilda bo'ladi; hisobsiz chatda — chatning o'zida (lang-store.ts).
 * Tanlanmagan bo'lsa Telegram ilovasi tiliga qaraladi. Tugmalar: `lng:menu` (tanlovni ko'rsatish), `lng:uz`, `lng:ru`.
 */
type Answer = (text: string) => Promise<unknown>;
type Account = { id: string; role: string } | null;

function choiceKeyboard(current: BotLang): TelegramButton[][] {
  const mark = (l: BotLang) => (l === current ? " ✓" : "");
  return [[{ text: `🇺🇿 O'zbekcha${mark("uz")}`, data: "lng:uz" }, { text: `🇷🇺 Русский${mark("ru")}`, data: "lng:ru" }]];
}

/** Til tanlovi — savol ikki tilda (foydalanuvchi joriy tilni tushunmasligi mumkin) */
export async function sendLanguageChoice(chatId: string, current: BotLang): Promise<void> {
  await sendTelegram(chatId, "🌐 <b>Tilni tanlang</b> · <b>Выберите язык</b>\n\nBot javoblari va bildirishnomalar tanlangan tilda keladi.\nОтветы бота и уведомления будут приходить на выбранном языке.", { keyboard: choiceKeyboard(current) });
}

/** `lng:*` tugmalari. Qaytaradi: yangi til (o'zgargan bo'lsa), `true` — tugma qayta ishlangan, `false` — bizniki emas */
export async function handleLanguageCallback(chatId: string, data: string, answer: Answer, msgId: number | null, me: Account, current: BotLang): Promise<boolean> {
  const m = /^lng:(menu|uz|ru)$/.exec(data);
  if (!m) return false;
  if (m[1] === "menu") {
    await answer("");
    await sendLanguageChoice(chatId, current);
    return true;
  }
  const lang = m[1] as BotLang;
  await saveLang(chatId, me, lang);
  await answer(L(lang, "Til: o'zbekcha", "Язык: русский"));
  // Buyruqlar menyusi va Mini App tugmasi ham shu tilda (Telegram ilovasi boshqa tilda bo'lsa ham)
  await applyChatLanguage(chatId, lang, me?.role === "admin").catch(() => undefined);
  if (msgId) await telegramApi("editMessageReplyMarkup", { chat_id: chatId, message_id: msgId, reply_markup: { inline_keyboard: choiceKeyboard(lang).map((row) => row.map((b) => ({ text: b.text, callback_data: b.data }))) } });
  const done = L(lang, "✅ Til: <b>o'zbekcha</b>. Bot javoblari va bildirishnomalar endi o'zbek tilida.", "✅ Язык: <b>русский</b>. Ответы бота и уведомления теперь на русском.");
  // Ulangan hisobda doimiy menyu ham yangi tilda chiziladi
  await sendTelegram(chatId, done, me ? { replyKeyboard: menuRows(me.role === "admin", lang) } : {});
  return true;
}
