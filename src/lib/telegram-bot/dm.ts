import "server-only";
import { ApiError } from "@/lib/api";
import { DM_BODY_MAX, listConversations, listMessages, loadConversationFor, markRead, sendDm, touchLastSeen } from "@/lib/chat/dm";
import type { FileAttachment } from "@/lib/db/schema";
import { rearmChatPing } from "@/lib/notifications";
import { assertCanDm } from "@/lib/privacy/blocks";
import { enforceLimit } from "@/lib/security/rate-limit";
import { cutPlain, escapeTelegramHtml, sendTelegram, sendTelegramEx, type TelegramButton } from "@/lib/telegram";
import { activeAccount } from "@/lib/telegram-bot/actions";
import { errorText } from "@/lib/telegram-bot/i18n";
import { L, plural, type BotLang } from "@/lib/telegram-bot/lang";
import { getBotSession, setBotSession, takeBotSession } from "@/lib/telegram-bot/session";
import { pageButton } from "@/lib/telegram-bot/ui";

/**
 * IKKI TOMONLAMA SHAXSIY XABARLAR (2026-11-10): sayt chati (DM) botning o'zida.
 *  /xabarlar      — suhbatlar ro'yxati (o'qilmaganlar birinchi, oxirgi xabar parchasi bilan), har biri tugma `dm:o:<suhbat>`
 *  dm:o:<suhbat>  — suhbatni ochish: oxirgi xabarlar + «✍️ Javob yozish»; suhbat «o'qildi» deb belgilanadi (saytdagi kabi)
 *  dm:r:<suhbat>  — javob rejimi (ForceReply): keyingi MATN shu suhbatga yuboriladi (`sendDm` — saytdagi POST bilan bir xil yo'l)
 *  Yangi xabar bildirishnomasi ostida ham shu tugmalar (lib/notifications.ts).
 * QOIDALAR (saytdagi /api/chat/[id] bilan bir xil): faqat suhbat ishtirokchisi; bloklangan suhbatdosh yoki blok/`dm_policy`
 * (`assertCanDm`) — yozib bo'lmaydi; chegara — saytdagi `messages` chelagi bilan UMUMIY (bot orqali chetlab o'tilmaydi).
 * MAXFIYLIK: o'z-o'zidan yo'qoladigan xabarlar (muddatli) Telegramga MATN bilan chiqarilmaydi — Telegramda ular abadiy qolardi;
 * muddati o'tganlari umuman ko'rinmaydi (`listMessages`). Biriktirma manzillari chiqmaydi — faqat turi («🖼 Rasm»), ochish saytda.
 * Javob bitta xabar uchun so'raladi (har javobdan keyin rejim yopiladi) — qidiruv matni adashib suhbatga ketib qolmasin.
 */
type Answer = (text: string) => Promise<unknown>;
type DmRow = Awaited<ReturnType<typeof listMessages>>[number];
interface DmSession extends Record<string, unknown> {
  convId: string;
  peerName: string;
  /** Javob so'ralgan bot xabari — boshqa (eski) so'rovga yozilgan javob adashib shu suhbatga ketmasin */
  promptId?: number | null;
}

const LIST_MAX = 8;
const THREAD_MAX = 8;
/** Suhbat ko'rinishida bitta xabardan ko'rsatiladigan matn: 8 ta xabar Telegram chegarasiga (4096) sig'ishi kerak — eng yangi xabarlar kesilib qolmasin */
const THREAD_TEXT_MAX = 350;
const CONV_RE = "[\\w-]{1,64}";

const isVoice = (a: FileAttachment) => a.type.startsWith("audio/") || /\.(?:weba|m4a|ogg)$/i.test(a.url);
/** Suhbat havolasi — `sendDm` bildirishnomasidagi bilan AYNAN bir xil (Telegram cheklovi kaliti shundan tuziladi) */
const chatHref = (convId: string): string => `/kabinet/chat?s=${convId}`;

/** Biriktirma yorlig'i (manzilsiz) */
function attachmentLabel(list: FileAttachment[], lang?: BotLang): string {
  const a = list[0];
  if (!a) return "";
  const more = list.length > 1 ? ` +${list.length - 1}` : "";
  if (isVoice(a)) return L(lang, "🎤 Ovozli xabar", "🎤 Голосовое сообщение") + more;
  if (a.round) return L(lang, "📹 Video xabar", "📹 Видеосообщение") + more;
  if (a.type.startsWith("image/")) return L(lang, "🖼 Rasm", "🖼 Фото") + more;
  if (a.type.startsWith("video/")) return L(lang, "🎬 Video", "🎬 Видео") + more;
  return L(lang, "📎 Fayl", "📎 Файл") + more;
}

/** Xabarning botda ko'rsatiladigan qisqa ko'rinishi (xom HTML'siz — chaqiruvchi ekranlaydi) */
function messagePreview(m: DmRow, max: number, lang?: BotLang): string {
  if (m.deletedAt) return L(lang, "🚫 Xabar o'chirilgan", "🚫 Сообщение удалено");
  // Muddatli (yo'qoladigan) xabar matni Telegramga chiqarilmaydi
  if (m.expiresAt) return L(lang, "⏳ Yo'qoladigan xabar — saytda o'qing", "⏳ Исчезающее сообщение — прочитайте на сайте");
  if (m.call) return m.call.video ? L(lang, "🎥 Video qo'ng'iroq", "🎥 Видеозвонок") : L(lang, "📞 Qo'ng'iroq", "📞 Звонок");
  const files = attachmentLabel(m.attachments ?? [], lang);
  const body = m.body.replace(/\s+/g, " ").trim();
  const text = body.length > max ? `${cutPlain(body, max)}…` : body;
  return [files, text].filter(Boolean).join(" · ") || L(lang, "(bo'sh xabar)", "(пустое сообщение)");
}

const fmtTime = (d: Date, lang?: BotLang): string => {
  const sameDay = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" }) === d.toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });
  return d.toLocaleString(lang === "ru" ? "ru-RU" : "uz-UZ", { timeZone: "Asia/Tashkent", ...(sameDay ? {} : { day: "2-digit", month: "2-digit" }), hour: "2-digit", minute: "2-digit" });
};

/** `/xabarlar` — suhbatlar ro'yxati */
export async function handleMessages(chatId: string, lang?: BotLang): Promise<void> {
  const me = await activeAccount(chatId, lang);
  if (!me) return;
  const all = (await listConversations(me.id, 40)).filter((c) => !c.prefs.archived && (c.last || c.unread > 0));
  if (!all.length) {
    await sendTelegram(chatId, L(lang, "💬 Hali suhbat yo'q. Ijodkor profilida «Yozish» tugmasini bosing — javoblar shu yerga ham keladi.", "💬 Переписок пока нет. Нажмите «Написать» в профиле специалиста — ответы будут приходить и сюда."), { keyboard: [[pageButton(L(lang, "Chatni ochish", "Открыть чат"), "/kabinet/chat")]] });
    return;
  }
  // O'qilmaganlar birinchi, keyin oxirgi faollik bo'yicha (listConversations tartibi saqlanadi)
  const rows = [...all.filter((c) => c.unread > 0), ...all.filter((c) => c.unread === 0)].slice(0, LIST_MAX);
  const unreadTotal = all.reduce((s, c) => s + (c.prefs.muted ? 0 : c.unread), 0);
  // Parcha: muddati o'tgan / men uchun o'chirilgan xabar chiqmasin — oxirgi ko'rinadigan xabar alohida olinadi
  const previews = await Promise.all(rows.map((c) => listMessages(c.id, me.id, null, 4).then((list) => list[list.length - 1] ?? null).catch(() => null)));
  const lines = rows.map((c, i) => {
    const m = previews[i];
    const who = m ? (m.senderId === me.id ? L(lang, "Siz: ", "Вы: ") : "") : "";
    const tail = m ? `${who}${messagePreview(m, 70, lang)}` : L(lang, "xabar yo'q", "сообщений нет");
    const badge = c.unread > 0 ? ` · <b>${plural(lang, c.unread, "yangi", ["новое", "новых", "новых"])}</b>` : "";
    return `${i + 1}. <b>${escapeTelegramHtml(c.peer.name)}</b>${badge}${c.prefs.muted ? " 🔕" : ""}\n   ${escapeTelegramHtml(tail)}`;
  });
  const head = unreadTotal > 0 ? L(lang, `💬 <b>Xabarlar</b> — ${unreadTotal} ta o'qilmagan`, `💬 <b>Сообщения</b> — непрочитанных: ${unreadTotal}`) : L(lang, "💬 <b>Xabarlar</b> — hammasi o'qilgan", "💬 <b>Сообщения</b> — всё прочитано");
  const keyboard: TelegramButton[][] = rows.map((c, i) => [{ text: `${i + 1}. ${cutPlain(c.peer.name, 28)}${c.unread > 0 ? ` (${c.unread})` : ""}`, data: `dm:o:${c.id}` }]);
  keyboard.push([pageButton(L(lang, "Barcha suhbatlar", "Все переписки"), "/kabinet/chat")]);
  await sendTelegram(chatId, `${head}\n\n${lines.join("\n\n")}\n\n${L(lang, "Suhbatni tanlang — o'qish va javob yozish shu yerda.", "Выберите переписку — читать и отвечать можно прямо здесь.")}`, { keyboard });
}

/** Yozish mumkinmi (saytdagi POST bilan bir xil tekshiruv). Mumkin emas — sababi (o'zbekcha `ApiError`) */
async function writeBlock(meId: string, found: NonNullable<Awaited<ReturnType<typeof loadConversationFor>>>): Promise<ApiError | null> {
  if (found.peer.isBanned) return new ApiError(403, "Bu foydalanuvchiga yozib bo'lmaydi");
  try {
    await assertCanDm(meId, found.peer, Boolean(found.conv.lastMessageAt));
    return null;
  } catch (e) {
    if (e instanceof ApiError) return e;
    throw e;
  }
}

/** Suhbatni chatga chiqarish: oxirgi xabarlar + tugmalar; «o'qildi» deb belgilaydi */
async function sendThread(chatId: string, meId: string, convId: string, lang?: BotLang): Promise<boolean> {
  const found = await loadConversationFor(meId, convId);
  if (!found) return false;
  const items = (await listMessages(convId, meId, null, THREAD_MAX * 2)).slice(-THREAD_MAX);
  const peerName = escapeTelegramHtml(found.peer.name);
  const lines = items.map((m) => {
    const mine = m.senderId === meId;
    const unread = !mine && m.createdAt.getTime() > found.myReadAt ? " 🆕" : "";
    return `<b>${mine ? L(lang, "Siz", "Вы") : peerName}</b> · ${escapeTelegramHtml(fmtTime(m.createdAt, lang))}${unread}\n${escapeTelegramHtml(messagePreview(m, THREAD_TEXT_MAX, lang))}`;
  });
  const denied = await writeBlock(meId, found);
  const keyboard: TelegramButton[][] = [];
  if (!denied) keyboard.push([{ text: L(lang, "✍️ Javob yozish", "✍️ Ответить"), data: `dm:r:${convId}` }]);
  keyboard.push([pageButton(L(lang, "Saytda ochish", "Открыть на сайте"), `/kabinet/chat?s=${convId}`), { text: L(lang, "⬅️ Suhbatlar", "⬅️ Переписки"), data: "dm:list" }]);
  const head = `💬 <b>${peerName}</b>${found.conv.ttlSeconds > 0 ? ` · ⏳ ${L(lang, "yo'qoladigan xabarlar yoqilgan", "исчезающие сообщения включены")}` : ""}`;
  const bodyText = lines.length ? lines.join("\n\n") : L(lang, "Bu suhbatda hali xabar yo'q.", "В этой переписке пока нет сообщений.");
  const note = denied ? `\n\n<i>${escapeTelegramHtml(await errorText(denied, lang, "Bu suhbatga yozib bo'lmaydi", "В эту переписку писать нельзя"))}</i>` : "";
  await sendTelegram(chatId, `${head}\n\n${bodyText}${note}`, { keyboard });
  // Xabarlar foydalanuvchiga ko'rsatildi — saytdagi kabi «o'qildi» (suhbatdoshda ✓✓); keyingi xabar yana Telegramga keladi
  await Promise.all([markRead(found.conv, meId), touchLastSeen(meId), rearmChatPing(meId, chatHref(convId))]).catch(() => undefined);
  return true;
}

/** Javob so'rash: ForceReply xabari va `dm` sessiyasi (so'rov xabari id'si bilan) */
async function askReply(chatId: string, meId: string, convId: string, lang?: BotLang): Promise<"ok" | "missing" | ApiError> {
  const found = await loadConversationFor(meId, convId);
  if (!found) return "missing";
  const denied = await writeBlock(meId, found);
  if (denied) return denied;
  const sent = await sendTelegramEx(
    chatId,
    L(lang, `✍️ <b>${escapeTelegramHtml(found.peer.name)}</b>ga javobingizni yozing (matn). Bekor qilish — /bekor`, `✍️ Напишите ответ для <b>${escapeTelegramHtml(found.peer.name)}</b> (текст). Отмена — /bekor`),
    { forceReply: cutPlain(L(lang, `${found.peer.name}ga javob…`, `Ответ для ${found.peer.name}…`), 60) },
  );
  const data: DmSession = { convId, peerName: found.peer.name, promptId: sent.messageId ?? null };
  await setBotSession(chatId, "dm", "reply", data);
  return "ok";
}

/** `dm:list` · `dm:o:<suhbat>` · `dm:r:<suhbat>`. false — bu tugma bizniki emas */
export async function handleDmCallback(chatId: string, data: string, answer: Answer, lang?: BotLang): Promise<boolean> {
  if (!data.startsWith("dm:")) return false;
  const m = new RegExp(`^dm:([or]):(${CONV_RE})$`).exec(data);
  if (data !== "dm:list" && !m) return false;
  const me = await activeAccount(chatId, lang);
  if (!me) {
    await answer(L(lang, "Avval hisobni ulang", "Сначала привяжите аккаунт"));
    return true;
  }
  try {
    if (data === "dm:list") {
      await answer("");
      await handleMessages(chatId, lang);
      return true;
    }
    if (m![1] === "o") {
      if (!(await sendThread(chatId, me.id, m![2], lang))) await answer(L(lang, "Suhbat topilmadi", "Переписка не найдена"));
      else await answer("");
      return true;
    }
    const r = await askReply(chatId, me.id, m![2], lang);
    if (r === "ok") await answer(L(lang, "Javobingizni yozing", "Напишите ответ"));
    else if (r === "missing") await answer(L(lang, "Suhbat topilmadi", "Переписка не найдена"));
    else await answer((await errorText(r, lang, "Yozib bo'lmaydi", "Писать нельзя")).slice(0, 180));
  } catch (e) {
    await answer((await errorText(e, lang, "Xatolik — saytdagi chatdan foydalaning", "Ошибка — воспользуйтесь чатом на сайте")).slice(0, 180));
  }
  return true;
}

/**
 * Faol javob rejimida matn keldi → xabar suhbatga yuboriladi. false — rejim faol emas (chaqiruvchi davom etadi).
 * `replyToMsgId` — foydalanuvchi qaysi bot xabariga javob yozgani (ForceReply): ESKI so'rovga yozilgan javob boshqa
 * (oxirgi tanlangan) suhbatga ketib qolmasligi uchun so'rov xabari id'si sessiyadagi bilan solishtiriladi.
 */
export async function handleDmText(chatId: string, text: string, lang: BotLang | undefined, replyToMsgId: number | null): Promise<boolean> {
  const s = await getBotSession<DmSession>(chatId);
  if (s?.flow !== "dm" || typeof s.data.convId !== "string") return false;
  const me = await activeAccount(chatId, lang);
  if (!me) return true;
  const again: TelegramButton[][] = [[{ text: L(lang, "✍️ Javob yozish", "✍️ Ответить"), data: `dm:r:${s.data.convId}` }, { text: L(lang, "💬 Suhbat", "💬 Переписка"), data: `dm:o:${s.data.convId}` }]];
  if (replyToMsgId != null && s.data.promptId != null && replyToMsgId !== s.data.promptId) {
    await sendTelegram(chatId, L(lang, `Bu eski so'rovga javob. Hozir <b>${escapeTelegramHtml(s.data.peerName)}</b> bilan suhbat tanlangan — kimga yozishni tugma bilan qayta tanlang.`, `Это ответ на старый запрос. Сейчас выбрана переписка с <b>${escapeTelegramHtml(s.data.peerName)}</b> — выберите получателя кнопкой ещё раз.`), { keyboard: [...again, [{ text: L(lang, "⬅️ Suhbatlar", "⬅️ Переписки"), data: "dm:list" }]] });
    return true;
  }
  const body = text.trim();
  if (body.length > DM_BODY_MAX) {
    await sendTelegram(chatId, L(lang, `Xabar juda uzun (${body.length} belgi, eng ko'pi ${DM_BODY_MAX}). Qisqartirib qayta yuboring.`, `Сообщение слишком длинное (символов: ${body.length}, максимум ${DM_BODY_MAX}). Сократите и отправьте снова.`));
    return true;
  }
  // Sessiya ATOMAR olinadi — qayta yuborilgan update yoki ikki marta yuborish ikkinchi xabar yaratmaydi
  const taken = await takeBotSession<DmSession>(chatId, "dm");
  if (!taken) return true;
  try {
    const found = await loadConversationFor(me.id, s.data.convId);
    if (!found) throw new ApiError(404, "Suhbat topilmadi");
    const denied = await writeBlock(me.id, found);
    if (denied) throw denied;
    await enforceLimit("messages", me.id);
    await sendDm(found.conv, me.id, body, [], null);
    // Botdan javob yozildi — suhbatdoshning javobi ham shu yerga (Telegramga) kelishi kerak
    await rearmChatPing(me.id, chatHref(s.data.convId));
    await sendTelegram(chatId, L(lang, `✅ Yuborildi: <b>${escapeTelegramHtml(found.peer.name)}</b>`, `✅ Отправлено: <b>${escapeTelegramHtml(found.peer.name)}</b>`), { keyboard: [[{ text: L(lang, "✍️ Yana yozish", "✍️ Написать ещё"), data: `dm:r:${s.data.convId}` }, { text: L(lang, "💬 Suhbat", "💬 Переписка"), data: `dm:o:${s.data.convId}` }]] });
  } catch (e) {
    await sendTelegram(chatId, `⚠️ ${escapeTelegramHtml(await errorText(e, lang, "Xabar yuborilmadi. Saytdagi chatdan urinib ko'ring.", "Сообщение не отправлено. Попробуйте через чат на сайте."))}`, { keyboard: [[pageButton(L(lang, "Saytda ochish", "Открыть на сайте"), `/kabinet/chat?s=${s.data.convId}`)]] });
  }
  return true;
}

/** Faol javob rejimida fayl keldi — bot orqali faqat matn yuboriladi (rejim saqlanadi). false — rejim faol emas */
export async function handleDmMedia(chatId: string, lang?: BotLang): Promise<boolean> {
  const s = await getBotSession<DmSession>(chatId);
  if (s?.flow !== "dm" || typeof s.data.convId !== "string") return false;
  await sendTelegram(chatId, L(lang, "Bot orqali suhbatga faqat matn yuboriladi. Rasm yoki fayl uchun saytdagi chatni oching — yoki javobni matn bilan yozing.", "Через бота в переписку отправляется только текст. Для фото или файла откройте чат на сайте — или напишите ответ текстом."), { keyboard: [[pageButton(L(lang, "Saytda ochish", "Открыть на сайте"), `/kabinet/chat?s=${s.data.convId}`)]] });
  return true;
}
