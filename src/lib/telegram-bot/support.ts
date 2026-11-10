import "server-only";
import { FEEDBACK_TEXT_MAX, createFeedback } from "@/lib/feedback";
import { cutPlain, escapeTelegramHtml, sendTelegram, telegramDownloadFile } from "@/lib/telegram";
import { SUPPORT_PAGE, notifyAdminsNewFeedback } from "@/lib/telegram-bot/admin";
import { defer } from "@/lib/telegram-bot/defer";
import { LIMITED_TEXT, botLimited } from "@/lib/telegram-bot/guard";
import { errorText } from "@/lib/telegram-bot/i18n";
import { L, type BotLang } from "@/lib/telegram-bot/lang";
import { sniffImage, storeTelegramFile, type IncomingMedia } from "@/lib/telegram-bot/media";
import { clearBotSession, getBotSession, setBotSession, takeBotSession } from "@/lib/telegram-bot/session";

/**
 * QO'LLAB-QUVVATLASH BOTDA (2026-11-10): /yordam → «✍️ Qo'llab-quvvatlashga yozish» (`sup:start`) → foydalanuvchining KEYINGI
 * xabari (matn; ixtiyoriy rasm — izohi bilan yoki alohida) saytdagi «Fikr bildirish» bilan BIR joyga yoziladi
 * (`createFeedback` → admin panel «Fikrlar») va adminlarga Telegram ogohlantirishi ketadi (`notifyAdminsNewFeedback`).
 * Hisobsiz (mehmon) va bloklangan foydalanuvchi ham yoza oladi — blok matni aynan shu yo'lni ko'rsatadi.
 * Holat: `bot_sessions` flow="support" ({fileId?} — rasm oldin kelgan bo'lsa); yuborishda sessiya ATOMAR olinadi
 * (`takeBotSession`) — xabar ikki marta yozilmaydi. Chegara: `tgSupport` (chat bo'yicha) — qiymati foydalanuvchiga aytilmaydi.
 */
type Answer = (text: string) => Promise<unknown>;
export interface SupportSender {
  /** Chatga ulangan hisob (yo'q — mehmon) */
  userId: string | null;
  name?: string;
  username?: string;
}
interface SupportData extends Record<string, unknown> {
  fileId?: string;
}

const TEXT_MIN = 5;
const TEXT_MAX = FEEDBACK_TEXT_MAX;
const SHOT_MAX_BYTES = 10 * 1024 * 1024;

const cancelRow = (lang?: BotLang) => [[{ text: L(lang, "✖️ Bekor qilish", "✖️ Отмена"), data: "sup:no" }]];

/** Qo'llab-quvvatlashga yozish rejimini boshlash */
export async function startSupport(chatId: string, lang?: BotLang): Promise<void> {
  await setBotSession(chatId, "support", "text", {});
  await sendTelegram(
    chatId,
    L(
      lang,
      "✍️ <b>Qo'llab-quvvatlash</b>\nSavol yoki muammoni <b>bitta xabarda</b> yozing — nima qilmoqchi edingiz va nima chiqdi. Skrinshot bo'lsa, rasmni izohi bilan yuboring.",
      "✍️ <b>Поддержка</b>\nОпишите вопрос или проблему <b>одним сообщением</b> — что вы делали и что получилось. Если есть скриншот, отправьте фото с подписью.",
    ),
    { keyboard: cancelRow(lang) },
  );
}

/** `sup:start` · `sup:no`. false — bu tugma bizniki emas */
export async function handleSupportCallback(chatId: string, data: string, answer: Answer, lang?: BotLang): Promise<boolean> {
  if (data === "sup:start") {
    await answer("");
    await startSupport(chatId, lang);
    return true;
  }
  if (data === "sup:no") {
    const s = await getBotSession(chatId);
    if (s?.flow === "support") await clearBotSession(chatId);
    await answer(L(lang, "Bekor qilindi", "Отменено"));
    return true;
  }
  return false;
}

/** Faol «support» oqimida matn keldi → xabar yoziladi. false — oqim faol emas (chaqiruvchi davom etadi) */
export async function handleSupportText(chatId: string, text: string, lang: BotLang | undefined, from: SupportSender): Promise<boolean> {
  const s = await getBotSession<SupportData>(chatId);
  if (s?.flow !== "support") return false;
  await submit(chatId, text, typeof s.data.fileId === "string" ? s.data.fileId : null, lang, from);
  return true;
}

/** Faol «support» oqimida fayl keldi: rasm — skrinshot (izoh = matn; izohsiz bo'lsa matn so'raladi), boshqa tur — tushuntirish */
export async function handleSupportMedia(chatId: string, media: IncomingMedia, caption: string, lang: BotLang | undefined, from: SupportSender): Promise<boolean> {
  const s = await getBotSession<SupportData>(chatId);
  if (s?.flow !== "support") return false;
  if (media.kind !== "photo") {
    await sendTelegram(chatId, L(lang, "Qo'llab-quvvatlashga matn va rasm (skrinshot) yuborish mumkin. Muammoni matn bilan yozing.", "В поддержку можно отправить текст и фото (скриншот). Опишите проблему текстом."), { keyboard: cancelRow(lang) });
    return true;
  }
  const text = caption.trim();
  if (text.length < TEXT_MIN) {
    await setBotSession(chatId, "support", "text", { fileId: media.fileId });
    await sendTelegram(chatId, L(lang, "🖼 Rasm qabul qilindi. Endi muammoni matn bilan yozing — birga yuboraman.", "🖼 Фото получено. Теперь опишите проблему текстом — отправлю вместе."), { keyboard: cancelRow(lang) });
    return true;
  }
  await submit(chatId, text, media.fileId, lang, from);
  return true;
}

async function submit(chatId: string, rawText: string, fileId: string | null, lang: BotLang | undefined, from: SupportSender): Promise<void> {
  const body = cutPlain(rawText.trim(), TEXT_MAX);
  if (body.length < TEXT_MIN) {
    await sendTelegram(chatId, L(lang, "Biroz batafsilroq yozing — nima bo'lganini tushunishimiz uchun.", "Напишите чуть подробнее — чтобы мы поняли, что произошло."), { keyboard: cancelRow(lang) });
    return;
  }
  // Sessiya ATOMAR olinadi: ikki marta bosish / qayta yuborilgan update ikkinchi yozuv yaratmaydi
  if (!(await takeBotSession(chatId, "support"))) return;
  if (await botLimited(chatId, "tgSupport")) {
    await sendTelegram(chatId, LIMITED_TEXT(lang));
    return;
  }
  // Skrinshot: Telegram'dan yuklab, saytdagi yuklamalar bilan bir joyga saqlanadi (faqat haqiqiy rasm — baytlardan aniqlanadi)
  let screenshotUrl: string | null = null;
  if (fileId) {
    try {
      const bytes = await telegramDownloadFile(fileId, SHOT_MAX_BYTES);
      const img = bytes ? sniffImage(bytes) : null;
      if (bytes && img) screenshotUrl = await storeTelegramFile(bytes, img.mime, img.ext);
    } catch (e) {
      console.error("[telegram:support] skrinshot", e instanceof Error ? e.message : e);
    }
  }
  // Admin javob yoza olishi uchun: Telegram taxallusi / ismi va chat (mehmonda hisob yo'q — yagona aloqa shu). «Qurilma»
  // maydoniga yoziladi (admin panelda va admin Telegram ogohlantirishida ko'rinadi) — foydalanuvchi matni o'zgarishsiz qoladi
  const sign = `Telegram bot${from.username ? ` · @${from.username}` : ""}${from.name ? ` · ${from.name}` : ""} · chat ${chatId}`;
  try {
    const row = await createFeedback({ kind: "other", text: body, page: SUPPORT_PAGE, screenshotUrl }, from.userId, cutPlain(sign, 280));
    defer(() => notifyAdminsNewFeedback(row.id), "support");
    await sendTelegram(
      chatId,
      L(
        lang,
        `✅ <b>Xabaringiz qabul qilindi.</b>${fileId && !screenshotUrl ? "\n(Rasmni saqlab bo'lmadi — matn yuborildi.)" : ""}\nAdministrator ko'rib chiqadi; kerak bo'lsa siz bilan bog'lanadi.`,
        `✅ <b>Сообщение принято.</b>${fileId && !screenshotUrl ? "\n(Фото сохранить не удалось — отправлен только текст.)" : ""}\nАдминистратор рассмотрит его и при необходимости свяжется с вами.`,
      ),
    );
  } catch (e) {
    await sendTelegram(chatId, `⚠️ ${escapeTelegramHtml(await errorText(e, lang, "Xabar yuborilmadi. Birozdan keyin qayta urinib ko'ring.", "Сообщение не отправлено. Попробуйте чуть позже."))}`);
  }
}
