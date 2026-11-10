import "server-only";
import { L, type BotLang } from "@/lib/telegram-bot/lang";
import { eq } from "drizzle-orm";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { specialists, users, type FileAttachment } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { cutPlain, escapeTelegramHtml, sendTelegram, telegramApi, telegramDownloadFile, type TelegramButton } from "@/lib/telegram";
import { isR2Enabled, r2Put } from "@/lib/storage/r2";
import { uploadDir } from "@/lib/uploads";
import { uid } from "@/lib/utils";
import { STORY_CAPTION_MAX } from "@/lib/social/limits";
import { RECEIPT_FRESH_MS, handleReceiptPhoto, openReceiptInvoices } from "@/lib/mentorship/telegram-pay";
import { clearBotSession, getBotSession, newNonce, setBotSession, takeBotSession } from "@/lib/telegram-bot/session";
import { defer } from "@/lib/telegram-bot/defer";
import { firstSeen } from "@/lib/telegram-bot/guard";
import { errorText } from "@/lib/telegram-bot/i18n";
import { pageButton } from "@/lib/telegram-bot/ui";

/**
 * BOT ORQALI POST (2026-10-31): mutaxassis botga rasm yoki video (izoh = caption) yuboradi → «Lentaga post qilamizmi?» →
 * «✅ Post qilish» → fayl Telegram'dan yuklab olinadi (≤20 MB — Bot API chegarasi), saytdagi yuklash bilan bir joyga
 * (R2 → Blob → disk) saqlanadi va profil posti yaratiladi (`createProfilePost` — obunachilarga bildirishnoma, limit `assertQuota`).
 * Holat `bot_sessions` (flow="post"): {fileId, kind, mime, caption, size, nonce}; tugmalar `pst:<ok|story|cap|no|rc>:<nonce>`.
 *
 * IKKI MARTA JOYLANMASLIK (2026-11-10): tugmalar FAYLGA bog'langan (`nonce` — eski taklif ostidagi tugma oxirgi faylni
 * joylamaydi); «Post qilish» bosilganda sessiya yuklab olishdan OLDIN atomar olinadi (`takeBotSession`) va taklifdagi
 * tugmalar olib tashlanadi — ikkinchi bosish yoki Telegram'ning qayta yuborishi ikkinchi post yaratmaydi (haftalik limitni
 * yemaydi). Yuklash va joylash javobdan keyin bajariladi. Albom — bitta taklif (birinchi fayl).
 *
 * CHEK: ochiq qo'lda-o'tkazma xaridi (kurs/kontakt) bo'lsa rasm/PDF chek bo'lib ketadi. Hisob 2 soatdan eski bo'lsa —
 * mutaxassisdan «chekmi yoki post?» so'raladi (ilgari bank skrinshoti bir bosishda ommaviy post bo'lishi mumkin edi),
 * mijozda esa (post qila olmaydi) to'g'ridan-to'g'ri chek hisoblanadi.
 */
export interface IncomingMedia {
  fileId: string;
  kind: "photo" | "video" | "pdf";
  mime: string;
  size: number;
  width?: number;
  height?: number;
  duration?: number;
}
interface PostData extends Record<string, unknown> {
  fileId: string;
  kind: "photo" | "video";
  mime: string;
  size: number;
  caption: string;
  duration: number | null;
  width: number | null;
  height: number | null;
  nonce: string;
  /** «Chekmi yoki post?» holati: rasm shu ochiq hisobning cheki bo'lishi mumkin */
  receiptInvoiceId?: string | null;
}
const MAX_BYTES = 20 * 1024 * 1024;
const POST_CAPTION_MAX = 2000;

function sniffImage(b: Buffer): { ext: string; mime: string } | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (b.length >= 8 && b.subarray(1, 4).toString("ascii") === "PNG") return { ext: "png", mime: "image/png" };
  if (b.length >= 12 && b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP") return { ext: "webp", mime: "image/webp" };
  return null;
}

/** Faylni saytdagi yuklash bilan bir xil joyga saqlaydi (R2 → Blob → disk); URL qaytaradi */
export async function storeTelegramFile(bytes: Buffer, mime: string, ext: string): Promise<string | null> {
  const name = `${uid()}.${ext}`;
  if (isR2Enabled()) return r2Put(`uploads/${name}`, bytes, mime);
  if (process.env.BLOB_READ_WRITE_TOKEN) return (await put(`uploads/${name}`, bytes, { access: "public", contentType: mime, addRandomSuffix: false })).url;
  if (process.env.VERCEL) return null;
  await mkdir(uploadDir(), { recursive: true });
  await writeFile(path.join(uploadDir(), name), bytes);
  return `/uploads/${name}`;
}

/** Botga rasm / video / PDF keldi: chek yoki post taklifi. `groupId` — albom (bir nechta fayl bitta xabarda) */
export async function handleIncomingMedia(chatId: string, media: IncomingMedia, caption: string, lang?: BotLang, groupId: string | null = null): Promise<void> {
  const user = await db.query.users.findFirst({ where: eq(users.telegramChatId, chatId), columns: { id: true, role: true, isBanned: true } });
  if (!user || user.isBanned) {
    await sendTelegram(chatId, L(lang, "Rasm/video joylash uchun avval hisobga ulaning (/start).", "Чтобы публиковать фото/видео, сначала привяжите аккаунт (/start)."));
    return;
  }
  // Albom: har fayl alohida update bo'lib keladi — FAQAT birinchisiga javob beramiz (N ta taklif chiqib, oxirgisi joylanib ketmasin)
  const album = Boolean(groupId);
  if (groupId && !(await firstSeen(`tgAlbum:${chatId}:${groupId}`, 10 * 60 * 1000))) return;

  const open = await openReceiptInvoices(user.id);
  const fresh = open.find((i) => i.state === "created" && Date.now() - i.createdAt.getTime() < RECEIPT_FRESH_MS);
  const older = open[0] ?? null;

  if (media.kind === "pdf") {
    // PDF faqat to'lov cheki bo'la oladi (post emas)
    if (older) await handleReceiptPhoto(chatId, media.fileId, lang, { invoiceId: (fresh ?? older).id });
    else await sendTelegram(chatId, L(lang, "PDF faylni faqat to'lov cheki sifatida qabul qilaman, hozir esa ochiq karta to'lovingiz yo'q. Post uchun rasm yoki video yuboring.", "PDF я принимаю только как чек оплаты, а открытых переводов на карту у вас сейчас нет. Для поста отправьте фото или видео."));
    return;
  }
  // Yaqinda (2 soat ichida) boshlangan karta to'lovi bor — rasm so'roqsiz chek
  if (media.kind === "photo" && fresh) {
    await handleReceiptPhoto(chatId, media.fileId, lang, { invoiceId: fresh.id });
    return;
  }
  if (user.role === "client") {
    // Mijoz post qila olmaydi: eski ochiq hisob bo'lsa rasm — chek; aks holda tushuntiramiz
    if (media.kind === "photo" && older) await handleReceiptPhoto(chatId, media.fileId, lang, { invoiceId: older.id });
    else
      await sendTelegram(
        chatId,
        L(
          lang,
          "Lentaga post faqat mutaxassislar uchun. Ijodkor sifatida ishlasangiz — profilingizda rolni o'zgartiring (Kabinet → Profil).\n\nBu to'lov cheki bo'lsa — avval to'lovni boshlang: xarid sahifasida «Telegramda to'lash» → «Karta o'tkazmasi».",
          "Посты в ленту — только для специалистов. Если вы работаете как автор, смените роль в профиле (Кабинет → Профиль).\n\nЕсли это чек оплаты — сначала начните оплату: на странице покупки «Оплатить в Telegram» → «Перевод на карту».",
        ),
      );
    return;
  }
  if (media.size > MAX_BYTES) {
    await sendTelegram(chatId, L(lang, "Fayl 20 MB dan katta — Telegram boti shunchalik hajmni bera olmaydi. Kattaroq videoni ilovada «Yaratish» orqali yuklang.", "Файл больше 20 МБ — Telegram-бот такой размер не отдаёт. Видео покрупнее загрузите в приложении через «Создать»."), { keyboard: [[pageButton(L(lang, "Ilovada yuklash", "Загрузить в приложении"), "/kabinet/postlar")]] });
    return;
  }
  const cap = cutPlain(caption.trim(), POST_CAPTION_MAX);
  const nonce = newNonce();
  // Eski ochiq hisob bor: bu chek ham bo'lishi mumkin — so'raymiz (tugma shu hisobga bog'lanadi)
  const receiptInvoiceId = media.kind === "photo" && older ? older.id : null;
  const data: PostData = { fileId: media.fileId, kind: media.kind, mime: media.mime, size: media.size, caption: cap, duration: media.duration ?? null, width: media.width ?? null, height: media.height ?? null, nonce, receiptInvoiceId };
  await setBotSession(chatId, "post", cap || receiptInvoiceId ? "confirm" : "caption", data);
  const what = media.kind === "video" ? L(lang, "🎬 Video", "🎬 Видео") : L(lang, "🖼 Rasm", "🖼 Фото");
  const albumNote = album ? `\n\n<i>${L(lang, "Albomdan bitta (birinchi) fayl olindi — bir nechta rasmli postni ilovada «Yaratish» orqali joylang.", "Из альбома взят один (первый) файл — пост с несколькими фото публикуйте в приложении через «Создать».")}</i>` : "";
  const capLine = cap ? `\n<i>${escapeTelegramHtml(cutPlain(cap, 200))}${cap.length > 200 ? "…" : ""}</i>` : "";
  let text: string;
  if (receiptInvoiceId) text = `${what} ${L(lang, "qabul qilindi", "получено")}.${capLine}\n\n${L(lang, "Sizda tasdiqlanmagan karta to'lovi bor. <b>Bu to'lov chekimi yoki post?</b>", "У вас есть неподтверждённый перевод на карту. <b>Это чек оплаты или пост?</b>")}`;
  else if (cap) text = `${what} ${L(lang, "qabul qilindi", "получено")}.${capLine}\n\n${L(lang, "<b>Qayerga joylaymiz?</b> Post — lentaga (obunachilarga bildirishnoma), Story — 24 soatlik halqaga.", "<b>Куда публикуем?</b> Пост — в ленту (подписчикам придёт уведомление), Story — в 24-часовое кольцо.")}`;
  else text = `${what} ${L(lang, "qabul qilindi. <b>Izoh yozing</b> (post matni) yoki izohsiz joylang.", "получено. <b>Напишите подпись</b> (текст поста) или опубликуйте без неё.")}`;
  await sendTelegram(chatId, text + albumNote, { keyboard: postChoiceKeyboard(lang, Boolean(cap), nonce, Boolean(receiptInvoiceId)) });
}

/** Post/story tanlov tugmalari (izoh bor — «Izohni o'zgartirish» ham; `receipt` — «Bu to'lov cheki» ham) — hammasi shu faylning `nonce`i bilan */
function postChoiceKeyboard(lang: BotLang | undefined, withCaption: boolean, nonce: string, receipt = false): TelegramButton[][] {
  const first: TelegramButton[] = [{ text: withCaption ? L(lang, "✅ Post qilish", "✅ Опубликовать пост") : L(lang, "✅ Izohsiz post", "✅ Пост без подписи"), data: `pst:ok:${nonce}` }, { text: L(lang, "📖 Story qilish", "📖 В Story"), data: `pst:story:${nonce}` }];
  const cancel: TelegramButton = { text: L(lang, "✖️ Bekor", "✖️ Отмена"), data: `pst:no:${nonce}` };
  const second: TelegramButton[] = withCaption ? [{ text: L(lang, "✍️ Izohni o'zgartirish", "✍️ Изменить подпись"), data: `pst:cap:${nonce}` }, cancel] : [cancel];
  return [...(receipt ? [[{ text: L(lang, "🧾 Bu to'lov cheki", "🧾 Это чек оплаты"), data: `pst:rc:${nonce}` }]] : []), first, second];
}

/** Matn — izoh (faqat faol post oqimida, «caption» qadamida) */
export async function handlePostText(chatId: string, text: string, lang?: BotLang): Promise<boolean> {
  const s = await getBotSession<PostData>(chatId);
  if (!s || s.flow !== "post") return false;
  if (s.step === "caption") {
    const cap = cutPlain(text.trim(), POST_CAPTION_MAX);
    await setBotSession(chatId, "post", "confirm", { ...s.data, caption: cap });
    await sendTelegram(chatId, `${L(lang, "Izoh", "Подпись")}: <i>${escapeTelegramHtml(cutPlain(cap, 200))}${cap.length > 200 ? "…" : ""}</i>\n\n${L(lang, "<b>Qayerga joylaymiz?</b>", "<b>Куда публикуем?</b>")}`, {
      keyboard: postChoiceKeyboard(lang, true, s.data.nonce, Boolean(s.data.receiptInvoiceId)),
    });
    return true;
  }
  await sendTelegram(chatId, L(lang, "Yuqoridagi xabarda «Post qilish» yoki «Bekor» tugmasini bosing 👆", "Нажмите «Опубликовать пост» или «Отмена» в сообщении выше 👆"));
  return true;
}

/** Limit tugagan bo'lsa — tushuntirish matni (uz/ru); joy bor bo'lsa null. Yakuniy tekshiruv baribir `assertQuota`da */
async function quotaBlock(userId: string, kind: "post" | "story", lang?: BotLang): Promise<string | null> {
  const { quotaFor } = await import("@/lib/social/quota");
  const q = await quotaFor(userId);
  const part = kind === "post" ? q.posts : q.stories;
  if (part.limit === null || part.used < part.limit) return null;
  const hours = part.resetAt ? Math.max(1, Math.ceil((part.resetAt - Date.now()) / 3_600_000)) : 0;
  const when = !hours ? "" : hours >= 24 ? L(lang, ` Keyingisi ${Math.ceil(hours / 24)} kundan keyin.`, ` Следующая — через ${Math.ceil(hours / 24)} дн.`) : L(lang, ` Keyingisi ${hours} soatdan keyin.`, ` Следующая — через ${hours} ч.`);
  const up = q.tier === "max" ? "" : L(lang, " Ko'proq joylash — Pro/Max tarifda (Kabinet → Obuna).", " Публиковать больше — на тарифах Pro/Max (Кабинет → Подписка).");
  return kind === "post" ? L(lang, `Haftalik post limiti tugadi (${part.limit} ta).${when}${up}`, `Недельный лимит постов исчерпан (${part.limit}).${when}${up}`) : L(lang, `Haftalik story limiti tugadi (${part.limit} ta).${when}${up}`, `Недельный лимит story исчерпан (${part.limit}).${when}${up}`);
}

/** Taklif xabarini natija matni bilan almashtirish (tugmalar yo'qoladi); xabar id'si yo'q bo'lsa — yangi xabar */
async function setPrompt(chatId: string, msgId: number | null, html: string): Promise<void> {
  if (msgId) {
    const r = await telegramApi("editMessageText", { chat_id: chatId, message_id: msgId, text: html, parse_mode: "HTML" });
    if (r?.ok) return;
  }
  await sendTelegram(chatId, html);
}

/** Faylni yuklab, saqlab, post yoki story yaratish (javobdan keyin bajariladi) */
async function publish(chatId: string, userId: string, d: PostData, asStory: boolean, msgId: number | null, lang?: BotLang): Promise<void> {
  try {
    const { assertQuota } = await import("@/lib/social/quota");
    await assertQuota(userId, asStory ? "story" : "post");
    const bytes = await telegramDownloadFile(d.fileId, MAX_BYTES);
    if (!bytes) throw new ApiError(400, L(lang, "Faylni Telegram'dan olib bo'lmadi (20 MB gacha bo'lishi kerak). Qaytadan yuboring.", "Не удалось получить файл из Telegram (до 20 МБ). Отправьте заново."));
    let mime = d.mime;
    let ext: string;
    if (d.kind === "photo") {
      const k = sniffImage(bytes);
      if (!k) throw new ApiError(400, L(lang, "Rasm formati tushunarsiz — JPG/PNG/WebP yuboring.", "Формат изображения не распознан — отправьте JPG/PNG/WebP."));
      mime = k.mime;
      ext = k.ext;
    } else {
      ext = /quicktime/.test(mime) ? "mov" : /webm/.test(mime) ? "webm" : "mp4";
      if (!/^video\//.test(mime)) mime = "video/mp4";
    }
    const url = await storeTelegramFile(bytes, mime, ext);
    if (!url) throw new ApiError(500, L(lang, "Fayl saqlash xizmati sozlanmagan — administratorga xabar bering.", "Хранилище файлов не настроено — сообщите администратору."));
    const att: FileAttachment = { url, name: `telegram.${ext}`, size: bytes.length, type: mime, ...(d.duration ? { duration: d.duration } : {}) };
    if (asStory) {
      // Story: 24 soat yashaydi, bosh sahifadagi halqada; izoh — story matni (saytdagi chegara bilan bir xil)
      const { createStory } = await import("@/lib/stories/service");
      await createStory(userId, { media: att, caption: cutPlain(d.caption, STORY_CAPTION_MAX), bg: null, music: null });
      await setPrompt(chatId, msgId, L(lang, "✅ <b>Story joylandi!</b> 24 soat davomida obunachilaringiz halqada ko'radi.", "✅ <b>Story опубликована!</b> 24 часа подписчики увидят её в кольце."));
      await sendTelegram(chatId, L(lang, "Story'ni ko'rish:", "Посмотреть story:"), { keyboard: [[pageButton(L(lang, "Lentani ochish", "Открыть ленту"), "/")]] });
      return;
    }
    const { createProfilePost } = await import("@/lib/profile/posts");
    const post = await createProfilePost(userId, d.caption, [att]);
    const sp = await db.query.specialists.findFirst({ where: eq(specialists.userId, userId), columns: { slug: true } });
    const href = sp ? `/mutaxassislar/${sp.slug}?post=${post.id}` : `/kabinet/postlar`;
    await setPrompt(chatId, msgId, L(lang, "✅ <b>Post joylandi!</b> «Har post» obunasini yoqqan obunachilaringizga xabar ketdi.", "✅ <b>Пост опубликован!</b> Подписчикам, включившим уведомления о каждом посте, отправлено сообщение."));
    await sendTelegram(chatId, L(lang, "Postni ko'rish va tahrirlash:", "Посмотреть и отредактировать пост:"), { keyboard: [[pageButton(L(lang, "Postni ochish", "Открыть пост"), href)]] });
  } catch (e) {
    console.error("[telegram:post]", e instanceof ApiError ? e.message : e);
    const generic = L(lang, `${asStory ? "Story" : "Post"} joylanmadi — keyinroq qayta urinib ko'ring.`, `${asStory ? "Story" : "Пост"} не опубликован — попробуйте позже.`);
    // 429 — haftalik limit (shu orada tugagan): o'z ikki tilli matnimiz; boshqa ApiError — o'z matni (ruschaga o'girib)
    const why = e instanceof ApiError && e.status === 429 ? ((await quotaBlock(userId, asStory ? "story" : "post", lang).catch(() => null)) ?? generic) : e instanceof ApiError ? await errorText(e, lang, generic, generic) : generic;
    await setPrompt(chatId, msgId, `⚠️ ${escapeTelegramHtml(why)}\n\n${L(lang, "Qayta urinish uchun rasm/videoni yana yuboring.", "Чтобы попробовать снова, отправьте фото/видео ещё раз.")}`);
  }
}

/** `pst:<amal>:<nonce>` tugmalari */
export async function handlePostCallback(chatId: string, data: string, answer: (t: string) => Promise<unknown>, msgId: number | null, lang?: BotLang): Promise<boolean> {
  const m = /^pst:(ok|story|cap|no|rc)(?::([a-f0-9]{6}))?$/.exec(data);
  if (!m) return false;
  const action = m[1] as "ok" | "story" | "cap" | "no" | "rc";
  const nonce = m[2] ?? "";
  const s = await getBotSession<PostData>(chatId);
  // Tugma boshqa (eski) faylga tegishli yoki oqim tugagan: hech narsa joylanmaydi, eski tugmalar olib tashlanadi
  if (!s || s.flow !== "post" || !nonce || s.data.nonce !== nonce) {
    await answer(L(lang, "Bu tugma eskirgan — oxirgi yuborilgan fayl ostidagi tugmani bosing yoki faylni qaytadan yuboring", "Кнопка устарела — нажмите кнопку под последним файлом или отправьте файл заново"));
    if (msgId) await telegramApi("editMessageReplyMarkup", { chat_id: chatId, message_id: msgId, reply_markup: { inline_keyboard: [] } });
    return true;
  }
  if (action === "no") {
    await clearBotSession(chatId);
    await answer(L(lang, "Bekor qilindi", "Отменено"));
    await setPrompt(chatId, msgId, L(lang, "Post bekor qilindi. Yangi rasm/video yuborsangiz — qaytadan taklif qilaman.", "Публикация отменена. Отправьте новое фото/видео — предложу снова."));
    return true;
  }
  if (action === "cap") {
    await setBotSession(chatId, "post", "caption", s.data);
    await answer("");
    await sendTelegram(chatId, L(lang, "✍️ Post izohini yozing (2000 belgigacha):", "✍️ Напишите подпись к посту (до 2000 символов):"));
    return true;
  }
  const user = await db.query.users.findFirst({ where: eq(users.telegramChatId, chatId), columns: { id: true, role: true, isBanned: true } });
  if (!user || user.isBanned) {
    await answer(L(lang, "Avval hisobni ulang", "Сначала привяжите аккаунт"));
    return true;
  }
  if (action === "rc") {
    // «Bu to'lov cheki»: sessiya atomar olinadi (ikki marta bosilsa chek ikki marta biriktirilmaydi)
    const taken = await takeBotSession<PostData>(chatId, "post", nonce);
    if (!taken) {
      await answer(L(lang, "Allaqachon qabul qilindi", "Уже принято"));
      return true;
    }
    await answer(L(lang, "Chek sifatida qabul qilindi", "Принято как чек"));
    await setPrompt(chatId, msgId, L(lang, "🧾 Rasm to'lov cheki sifatida qabul qilindi — post qilinmaydi.", "🧾 Фото принято как чек оплаты — пост не публикуется."));
    await handleReceiptPhoto(chatId, taken.data.fileId, lang, taken.data.receiptInvoiceId ? { invoiceId: taken.data.receiptInvoiceId } : {});
    return true;
  }
  const asStory = action === "story";
  // Limit tugagan bo'lsa — sessiya saqlanadi (boshqa turni tanlash mumkin: post o'rniga story)
  const blocked = await quotaBlock(user.id, asStory ? "story" : "post", lang).catch(() => null);
  if (blocked) {
    await answer(blocked);
    await sendTelegram(chatId, `⚠️ ${escapeTelegramHtml(blocked)}`);
    return true;
  }
  // CAS: sessiya yuklab olishdan OLDIN olinadi — ikkinchi bosish / Telegram qayta yuborishi ikkinchi post yaratmaydi
  const taken = await takeBotSession<PostData>(chatId, "post", nonce);
  if (!taken) {
    await answer(L(lang, "Allaqachon joylanmoqda", "Уже публикуется"));
    return true;
  }
  await answer(L(lang, "Joylanmoqda…", "Публикуем…"));
  // Tugmalar olib tashlanadi (yuklash davomida qayta bosib bo'lmasin)
  await setPrompt(chatId, msgId, L(lang, `⏳ ${asStory ? "Story" : "Post"} joylanmoqda…`, `⏳ Публикуем ${asStory ? "story" : "пост"}…`));
  defer(() => publish(chatId, user.id, taken.data, asStory, msgId, lang), "post");
  return true;
}

/** /post — yo'riqnoma */
export async function sendPostHelp(chatId: string, lang?: BotLang): Promise<void> {
  await sendTelegram(
    chatId,
    L(
      lang,
      "📸 <b>Bot orqali post va story</b>\nShu chatga rasm yoki video yuboring (20 MB gacha), izohini rasm ostiga yozing — post (lentaga) yoki story (24 soat) sifatida joylashni taklif qilaman.\n\nMusiqa, stikerlar va bir nechta rasm — ilovada «Yaratish» orqali.",
      "📸 <b>Пост и story через бота</b>\nОтправьте в этот чат фото или видео (до 20 МБ), подпись — под фото; предложу опубликовать как пост (в ленту) или story (24 часа).\n\nМузыка, стикеры и несколько фото — в приложении через «Создать».",
    ),
    { keyboard: [[pageButton(L(lang, "📱 Ilovada yaratish", "📱 Создать в приложении"), "/kabinet/postlar")]] },
  );
}
