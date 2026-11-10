import "server-only";
import { escapeTelegramHtml, sendTelegram, telegramApi } from "@/lib/telegram";
import { adminByChat } from "@/lib/telegram-bot/admin";
import { defer } from "@/lib/telegram-bot/defer";
import { L, type BotLang } from "@/lib/telegram-bot/lang";
import { clearBotSession, getBotSession, newNonce, setBotSession, takeBotSession } from "@/lib/telegram-bot/session";
import type { TelegramTally } from "@/lib/broadcast";

/**
 * `/elon` — ommaviy e'lon, FAQAT admin chat (`adminByChat` — ADMIN_REQUIRE_2FA ham hisobga olinadi). Ikki yo'l:
 *  - bir xabarda: `/elon Sarlavha | Matn` (yoki `/elon` + Enter, 1-qator sarlavha, qolgani matn);
 *  - suhbat: `/elon` → bot sarlavhani so'raydi → matnni so'raydi (bot_sessions, flow="broadcast").
 * Oxirida oldindan ko'rish + auditoriya tugmalari `bc:<all|specialists|clients|no>:<nonce>`.
 *
 * XAVFSIZLIK (2026-11-10): tugmalar QORALAMAGA bog'langan (`nonce`) — eski ko'rinish ostidagi tugma yangi qoralamani
 * yubora olmaydi (ilgari «A» ko'rinishidagi «Hammaga» keyin yozilgan «B» matnini hammaga jo'natardi — qaytarib bo'lmaydi).
 * Tugma bosilganda avval javob beriladi, yuborish javobdan keyin (`defer`) bajariladi; natijada HAQIQIY yetkazilgan sonlar.
 */
type Answer = (text: string) => Promise<unknown>;
interface Draft extends Record<string, unknown> {
  title?: string;
  body?: string;
  nonce?: string;
}
const NOT_ADMIN = (lang?: BotLang) => L(lang, "Bu buyruq faqat administrator uchun.", "Эта команда только для администратора.");

export async function handleBroadcastStart(chatId: string, text: string, lang?: BotLang): Promise<void> {
  if (!(await adminByChat(chatId))) {
    await sendTelegram(chatId, NOT_ADMIN(lang));
    return;
  }
  const raw = text.replace(/^\/elon(@\w+)?\s*/i, "").trim();
  let title = "";
  let body = "";
  if (raw.includes("|")) {
    const i = raw.indexOf("|");
    title = raw.slice(0, i).trim();
    body = raw.slice(i + 1).trim();
  } else if (raw.includes("\n")) {
    const i = raw.indexOf("\n");
    title = raw.slice(0, i).trim();
    body = raw.slice(i + 1).trim();
  } else if (raw) {
    // Faqat sarlavha yozilgan — matnni so'raymiz
    title = raw;
  }
  try {
    if (title.length >= 4 && body.length >= 10) {
      await showBroadcastPreview(chatId, title.slice(0, 120), body.slice(0, 600), lang);
      return;
    }
    if (title.length >= 4) {
      await setBotSession(chatId, "broadcast", "body", { title: title.slice(0, 120) });
      await sendTelegram(chatId, L(lang, `📣 Sarlavha: <b>${escapeTelegramHtml(title.slice(0, 120))}</b>\n\nEndi e'lon <b>matnini</b> yozing (10–600 belgi). Bekor qilish — /start`, `📣 Заголовок: <b>${escapeTelegramHtml(title.slice(0, 120))}</b>\n\nТеперь напишите <b>текст</b> рассылки (10–600 символов). Отмена — /start`));
      return;
    }
    await setBotSession(chatId, "broadcast", "title", {});
    await sendTelegram(chatId, L(lang, "📣 <b>Ommaviy e'lon</b> — barcha foydalanuvchilarga (sayt + Telegram) bir vaqtda ketadi.\n\n1️⃣ E'lon <b>sarlavhasini</b> yozing (4–120 belgi).\n\n<i>Tezkor usul: <code>/elon Sarlavha | Matn</code>. Bekor qilish — /start</i>", "📣 <b>Рассылка</b> — уйдёт всем пользователям (сайт + Telegram) одновременно.\n\n1️⃣ Напишите <b>заголовок</b> (4–120 символов).\n\n<i>Быстрый способ: <code>/elon Заголовок | Текст</code>. Отмена — /start</i>"));
  } catch (e) {
    console.error("[telegram:elon]", e);
    await sendTelegram(chatId, L(lang, "⚠️ Xatolik yuz berdi. Admin paneldagi «Ommaviy xabar» bo'limidan yuborib ko'ring.", "⚠️ Произошла ошибка. Попробуйте раздел «Массовое сообщение» в админ-панели."));
  }
}

/** Suhbat rejimida matnli javob (sarlavha → matn) — faqat faol broadcast oqimida; `true` — qabul qilindi */
export async function handleBroadcastText(chatId: string, text: string, lang?: BotLang): Promise<boolean> {
  const s = await getBotSession<Draft>(chatId);
  if (!s || s.flow !== "broadcast") return false;
  if (!(await adminByChat(chatId))) {
    await clearBotSession(chatId);
    return false;
  }
  const t = text.trim();
  if (s.step === "title") {
    if (t.length < 4 || t.length > 120) {
      await sendTelegram(chatId, L(lang, "Sarlavha 4–120 belgi bo'lsin. Qaytadan yozing:", "Заголовок — 4–120 символов. Напишите ещё раз:"));
      return true;
    }
    await setBotSession(chatId, "broadcast", "body", { title: t });
    await sendTelegram(chatId, L(lang, `Sarlavha: <b>${escapeTelegramHtml(t)}</b> ✓\n\n2️⃣ Endi e'lon <b>matnini</b> yozing (10–600 belgi).`, `Заголовок: <b>${escapeTelegramHtml(t)}</b> ✓\n\n2️⃣ Теперь напишите <b>текст</b> рассылки (10–600 символов).`));
    return true;
  }
  if (s.step === "body") {
    if (t.length < 10 || t.length > 600) {
      await sendTelegram(chatId, L(lang, "Matn 10–600 belgi bo'lsin. Qaytadan yozing:", "Текст — 10–600 символов. Напишите ещё раз:"));
      return true;
    }
    await showBroadcastPreview(chatId, s.data.title ?? L(lang, "E'lon", "Объявление"), t, lang);
    return true;
  }
  await sendTelegram(chatId, L(lang, "Yuqoridagi xabarda auditoriya tugmasini bosing 👆 (bekor qilish — /start)", "Нажмите кнопку аудитории в сообщении выше 👆 (отмена — /start)"));
  return true;
}

/** Oldindan ko'rish + auditoriya tugmalari; qoralama sessiyada, tugmalar shu qoralamaning `nonce`iga bog'langan */
async function showBroadcastPreview(chatId: string, title: string, body: string, lang?: BotLang): Promise<void> {
  const nonce = newNonce();
  await setBotSession(chatId, "broadcast", "confirm", { title, body, nonce });
  const { audienceRows, channelStat } = await import("@/lib/broadcast");
  const all = await audienceRows("all");
  const st = channelStat(all);
  const sp = all.filter((r) => r.role === "specialist").length;
  const cl = all.filter((r) => r.role === "client").length;
  await sendTelegram(chatId, `<b>${escapeTelegramHtml(title)}</b>\n${escapeTelegramHtml(body)}\n\n${L(lang, `— Shunday ketadi. Kimga yuboramiz? (saytda ${all.length} kishi, Telegram ulangan ${st.telegram} kishi)`, `— Так и уйдёт. Кому отправить? (на сайте ${all.length} чел., Telegram подключён у ${st.telegram})`)}`, {
    keyboard: [
      [{ text: `${L(lang, "👥 Hammaga", "👥 Всем")} (${all.length})`, data: `bc:all:${nonce}` }],
      [
        { text: `${L(lang, "🎨 Mutaxassislar", "🎨 Специалистам")} (${sp})`, data: `bc:specialists:${nonce}` },
        { text: `${L(lang, "🧑‍💼 Mijozlar", "🧑‍💼 Клиентам")} (${cl})`, data: `bc:clients:${nonce}` },
      ],
      [{ text: L(lang, "✖️ Bekor qilish", "✖️ Отмена"), data: `bc:no:${nonce}` }],
    ],
  });
}

/** Telegram yetkazish hisobi bir qatorda: «yetkazildi 120 · bloklagan 3 · xato 1 · navbatda 40» */
function tallyLine(t: TelegramTally, lang?: BotLang): string {
  const parts = [L(lang, `yetkazildi ${t.delivered}`, `доставлено ${t.delivered}`)];
  if (t.blocked) parts.push(L(lang, `botni bloklagan ${t.blocked}`, `заблокировали бота ${t.blocked}`));
  if (t.failed) parts.push(L(lang, `xato ${t.failed}`, `ошибок ${t.failed}`));
  if (t.skipped) parts.push(L(lang, `o'tkazib yuborildi ${t.skipped}`, `пропущено ${t.skipped}`));
  if (t.pending) parts.push(L(lang, `navbatda ${t.pending}`, `в очереди ${t.pending}`));
  return `Telegram (${t.linked}): ${parts.join(" · ")}`;
}

/** `bc:<auditoriya|no>:<nonce>` — admin tasdiqlaydi; natija asl xabar ostiga yoziladi, tugmalar yo'qoladi */
export async function handleBroadcastCallback(chatId: string, data: string, answer: Answer, messageId: number | null, lang?: BotLang): Promise<boolean> {
  const m = /^bc:(all|specialists|clients|no)(?::([a-f0-9]{6}))?$/.exec(data);
  if (!m) return false;
  const me = await adminByChat(chatId);
  if (!me) {
    await answer(L(lang, "Faqat administrator uchun", "Только для администратора"));
    return true;
  }
  const nonce = m[2] ?? "";
  const setText = async (html: string) => {
    if (messageId) await telegramApi("editMessageText", { chat_id: chatId, message_id: messageId, text: html, parse_mode: "HTML" });
    else await sendTelegram(chatId, html);
  };
  const s = await getBotSession<Draft>(chatId);
  const current = s?.flow === "broadcast" && s.step === "confirm" && s.data.title && s.data.body ? s.data : null;
  // Tugma boshqa (eski) qoralamaga tegishli — hech narsa yuborilmaydi, eski tugmalar olib tashlanadi
  if (!current || !nonce || current.nonce !== nonce) {
    await answer(L(lang, "Bu tugma eskirgan — oxirgi ko'rinishdagi tugmani bosing", "Кнопка устарела — нажмите кнопку под последним предпросмотром"));
    if (messageId) await telegramApi("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } });
    return true;
  }
  const draftHtml = `<b>${escapeTelegramHtml(current.title!)}</b>\n${escapeTelegramHtml(current.body!)}\n\n`;
  // CAS: qoralama AYNAN shu nonce bilan o'chirilgandagina davom etamiz — ikki marta bosish / Telegram qayta yuborishi ikkinchi marta jo'natmaydi
  if (!(await takeBotSession(chatId, "broadcast", nonce))) {
    await answer(L(lang, "Allaqachon yuborilmoqda", "Уже отправляется"));
    return true;
  }
  if (m[1] === "no") {
    await answer(L(lang, "Bekor qilindi", "Отменено"));
    await setText(`${draftHtml}<b>${L(lang, "Bekor qilindi", "Отменено")}</b>`);
    return true;
  }
  const aud = m[1] as "all" | "specialists" | "clients";
  const AUD: Record<typeof aud, string> = { all: L(lang, "hammaga", "всем"), specialists: L(lang, "mutaxassislarga", "специалистам"), clients: L(lang, "mijozlarga", "клиентам") };
  // Avval javob (tugma «aylanib» turmasin) va tugmalarsiz holat; yuborish — javobdan keyin
  await answer(L(lang, "Yuborilmoqda…", "Отправляем…"));
  await setText(`${draftHtml}<b>⏳ ${L(lang, `Yuborilmoqda — ${AUD[aud]}…`, `Отправляем — ${AUD[aud]}…`)}</b>`);
  defer(async () => {
    try {
      const { sendBroadcast } = await import("@/lib/broadcast");
      const head = (sent: number) => L(lang, `✅ Yuborildi — ${AUD[aud]}: saytda ${sent} kishi`, `✅ Отправлено — ${AUD[aud]}: на сайте ${sent} чел.`);
      let finished = false;
      const r = await sendBroadcast({ title: current.title!, body: current.body!, audience: aud }, me.id, "telegram", undefined, {
        waitMs: 8000,
        // Navbat to'liq tugagach — yakuniy sonlar (katta auditoriyada bir necha daqiqadan keyin)
        onTelegramDone: async (t, sent) => {
          finished = true;
          if (sent === 0) await setText(`${draftHtml}<b>${L(lang, "Auditoriya bo'sh — yuboriladigan foydalanuvchi yo'q", "Аудитория пуста — отправлять некому")}</b>`);
          else await setText(`${draftHtml}<b>${escapeTelegramHtml(head(sent))}</b>\n${escapeTelegramHtml(tallyLine(t, lang))}`);
        },
      });
      // Navbat hali tugamagan bo'lsa — oraliq holat (yakuniysi `onTelegramDone`da yoziladi)
      if (!finished && r.telegram.pending > 0) await setText(`${draftHtml}<b>${escapeTelegramHtml(head(r.sent))}</b>\n${escapeTelegramHtml(tallyLine(r.telegram, lang))}\n<i>${L(lang, "Telegram navbati davom etmoqda — tugagach shu xabar yangilanadi.", "Очередь Telegram ещё идёт — сообщение обновится по завершении.")}</i>`);
    } catch (e) {
      console.error("[telegram:elon:send]", e);
      await setText(`${draftHtml}<b>⚠️ ${L(lang, "Yuborishda xatolik — admin paneldan tekshiring", "Ошибка при отправке — проверьте в админ-панели")}</b>`);
    }
  }, "elon");
  return true;
}
