import "server-only";
import { L, type BotLang } from "@/lib/telegram-bot/lang";
import { and, desc, eq } from "drizzle-orm";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { specialists, subscriptionInvoices, users, type FileAttachment } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { escapeTelegramHtml, sendTelegram, telegramApi, telegramDownloadFile } from "@/lib/telegram";
import { isR2Enabled, r2Put } from "@/lib/storage/r2";
import { uploadDir } from "@/lib/uploads";
import { uid } from "@/lib/utils";
import { siteUrl } from "@/lib/security/site";
import { isPurchase } from "@/lib/mentorship/purchases";
import { isContactUnlock } from "@/lib/contacts/unlock";
import { clearBotSession, getBotSession, setBotSession } from "@/lib/telegram-bot/session";
import { appUrl } from "@/lib/telegram-bot/app-url";

/**
 * BOT ORQALI POST (2026-10-31): mutaxassis botga rasm yoki video (izoh = caption) yuboradi → «Lentaga post qilamizmi?» →
 * «✅ Post qilish» → fayl Telegram'dan yuklab olinadi (≤20 MB — Bot API chegarasi), saytdagi yuklash bilan bir joyga
 * (R2 → Blob → disk) saqlanadi va profil posti yaratiladi (`createProfilePost` — obunachilarga bildirishnoma, limit `assertQuota`).
 * Chek rasmi oqimi saqlanadi: ochiq qo'lda-o'tkazma xaridi (kurs/kontakt, 2 soat ichida) bo'lsa rasm chek sifatida ketadi.
 * Holat `bot_sessions` (flow="post"): {fileId, kind, mime, caption, size}; tugmalar `pst:ok|cap|no`.
 */
export interface IncomingMedia {
  fileId: string;
  kind: "photo" | "video";
  mime: string;
  size: number;
  width?: number;
  height?: number;
  duration?: number;
}
const MAX_BYTES = 20 * 1024 * 1024;
const site = () => siteUrl() ?? "";

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

/** Foydalanuvchining 2 soat ichidagi ochiq karta-o'tkazma xaridi (kurs/kontakt) — rasm chek sifatida shunga biriktiriladi */
async function pendingReceiptInvoice(userId: string) {
  const open = await db.query.subscriptionInvoices.findMany({
    where: and(eq(subscriptionInvoices.userId, userId), eq(subscriptionInvoices.state, "created"), eq(subscriptionInvoices.provider, "manual")),
    orderBy: [desc(subscriptionInvoices.createdAt)],
    limit: 5,
  });
  return open.find((i) => (isPurchase(i) || isContactUnlock(i)) && Date.now() - i.createdAt.getTime() < 2 * 60 * 60 * 1000) ?? null;
}

/** Botga rasm/video keldi: chek yoki post taklifi */
export async function handleIncomingMedia(chatId: string, media: IncomingMedia, caption: string, lang?: BotLang): Promise<void> {
  const user = await db.query.users.findFirst({ where: eq(users.telegramChatId, chatId), columns: { id: true, role: true, isBanned: true } });
  if (!user || user.isBanned) {
    await sendTelegram(chatId, L(lang, "Rasm/video joylash uchun avval hisobga ulaning (/start).", "Чтобы публиковать фото/видео, сначала привяжите аккаунт (/start)."));
    return;
  }
  if (media.kind === "photo" && (await pendingReceiptInvoice(user.id))) {
    const { handleReceiptPhoto } = await import("@/lib/mentorship/telegram-pay");
    await handleReceiptPhoto(chatId, media.fileId);
    return;
  }
  if (user.role === "client") {
    await sendTelegram(chatId, L(lang, "Lentaga post faqat mutaxassislar uchun. Ijodkor sifatida ishlasangiz — profilingizda rolni o'zgartiring (Kabinet → Profil).", "Посты в ленту — только для специалистов. Если вы работаете как автор, смените роль в профиле (Кабинет → Профиль)."));
    return;
  }
  if (media.size > MAX_BYTES) {
    const up = L(lang, "Ilovada yuklash", "Загрузить в приложении");
    await sendTelegram(chatId, L(lang, "Fayl 20 MB dan katta — Telegram boti shunchalik hajmni bera olmaydi. Kattaroq videoni ilovada «Yaratish» orqali yuklang.", "Файл больше 20 МБ — Telegram-бот такой размер не отдаёт. Видео покрупнее загрузите в приложении через «Создать»."), { keyboard: [[appUrl("/kabinet/postlar") ? { text: up, webApp: appUrl("/kabinet/postlar")! } : { text: L(lang, "Saytda yuklash", "Загрузить на сайте"), url: `${site()}/kabinet/postlar` }]] });
    return;
  }
  const cap = caption.trim().slice(0, 2000);
  await setBotSession(chatId, "post", cap ? "confirm" : "caption", { fileId: media.fileId, kind: media.kind, mime: media.mime, size: media.size, caption: cap, duration: media.duration ?? null, width: media.width ?? null, height: media.height ?? null });
  const what = media.kind === "video" ? L(lang, "🎬 Video", "🎬 Видео") : L(lang, "🖼 Rasm", "🖼 Фото");
  if (cap) {
    await sendTelegram(chatId, `${what} ${L(lang, "qabul qilindi", "получено")}.\n<i>${escapeTelegramHtml(cap.slice(0, 200))}${cap.length > 200 ? "…" : ""}</i>\n\n${L(lang, "<b>Qayerga joylaymiz?</b> Post — lentaga (obunachilarga bildirishnoma), Story — 24 soatlik halqaga.", "<b>Куда публикуем?</b> Пост — в ленту (подписчикам придёт уведомление), Story — в 24-часовое кольцо.")}`, {
      keyboard: postChoiceKeyboard(lang, true),
    });
  } else {
    await sendTelegram(chatId, `${what} ${L(lang, "qabul qilindi. <b>Izoh yozing</b> (post matni) yoki izohsiz joylang.", "получено. <b>Напишите подпись</b> (текст поста) или опубликуйте без неё.")}`, {
      keyboard: postChoiceKeyboard(lang, false),
    });
  }
}

/** Post/story tanlov tugmalari (izoh bor — «Izohni o'zgartirish» ham) */
function postChoiceKeyboard(lang: BotLang | undefined, withCaption: boolean) {
  const first = [{ text: withCaption ? L(lang, "✅ Post qilish", "✅ Опубликовать пост") : L(lang, "✅ Izohsiz post", "✅ Пост без подписи"), data: "pst:ok" }, { text: L(lang, "📖 Story qilish", "📖 В Story"), data: "pst:story" }];
  const second = withCaption ? [{ text: L(lang, "✍️ Izohni o'zgartirish", "✍️ Изменить подпись"), data: "pst:cap" }, { text: L(lang, "✖️ Bekor", "✖️ Отмена"), data: "pst:no" }] : [{ text: L(lang, "✖️ Bekor", "✖️ Отмена"), data: "pst:no" }];
  return [first, second];
}

/** Matn — izoh (faqat faol post oqimida, «caption» qadamida) */
export async function handlePostText(chatId: string, text: string, lang?: BotLang): Promise<boolean> {
  const s = await getBotSession<{ fileId: string; kind: "photo" | "video"; caption: string }>(chatId);
  if (!s || s.flow !== "post") return false;
  if (s.step === "caption") {
    const cap = text.trim().slice(0, 2000);
    await setBotSession(chatId, "post", "confirm", { ...s.data, caption: cap });
    await sendTelegram(chatId, `${L(lang, "Izoh", "Подпись")}: <i>${escapeTelegramHtml(cap.slice(0, 200))}${cap.length > 200 ? "…" : ""}</i>\n\n${L(lang, "<b>Qayerga joylaymiz?</b>", "<b>Куда публикуем?</b>")}`, {
      keyboard: postChoiceKeyboard(lang, true),
    });
    return true;
  }
  await sendTelegram(chatId, L(lang, "Yuqoridagi xabarda «Post qilish» yoki «Bekor» tugmasini bosing 👆", "Нажмите «Опубликовать пост» или «Отмена» в сообщении выше 👆"));
  return true;
}

/** `pst:*` tugmalari */
export async function handlePostCallback(chatId: string, data: string, answer: (t: string) => Promise<unknown>, msgId: number | null, lang?: BotLang): Promise<boolean> {
  if (!data.startsWith("pst:")) return false;
  const s = await getBotSession<{ fileId: string; kind: "photo" | "video"; mime: string; size: number; caption: string; duration: number | null; width: number | null; height: number | null }>(chatId);
  if (!s || s.flow !== "post") {
    await answer(L(lang, "Fayl eskirgan — rasm/videoni qaytadan yuboring", "Файл устарел — отправьте фото/видео заново"));
    return true;
  }
  if (data === "pst:no") {
    await clearBotSession(chatId);
    await answer(L(lang, "Bekor qilindi", "Отменено"));
    if (msgId) await telegramApi("editMessageText", { chat_id: chatId, message_id: msgId, text: L(lang, "Post bekor qilindi. Yangi rasm/video yuborsangiz — qaytadan taklif qilaman.", "Публикация отменена. Отправьте новое фото/видео — предложу снова.") });
    return true;
  }
  if (data === "pst:cap") {
    await setBotSession(chatId, "post", "caption", s.data);
    await answer("");
    await sendTelegram(chatId, L(lang, "✍️ Post izohini yozing (2000 belgigacha):", "✍️ Напишите подпись к посту (до 2000 символов):"));
    return true;
  }
  if (data !== "pst:ok" && data !== "pst:story") return false;
  const asStory = data === "pst:story";
  await answer(L(lang, "Joylanmoqda…", "Публикуем…"));
  const user = await db.query.users.findFirst({ where: eq(users.telegramChatId, chatId), columns: { id: true, role: true } });
  if (!user) return true;
  try {
    const { assertQuota } = await import("@/lib/social/quota");
    await assertQuota(user.id, asStory ? "story" : "post");
    const bytes = await telegramDownloadFile(s.data.fileId, MAX_BYTES);
    if (!bytes) throw new ApiError(400, L(lang, "Faylni Telegram'dan olib bo'lmadi (20 MB gacha bo'lishi kerak). Qaytadan yuboring.", "Не удалось получить файл из Telegram (до 20 МБ). Отправьте заново."));
    let mime = s.data.mime;
    let ext: string;
    if (s.data.kind === "photo") {
      const k = sniffImage(bytes);
      if (!k) throw new ApiError(400, L(lang, "Rasm formati tushunarsiz — JPG/PNG/WebP yuboring.", "Формат изображения не распознан — отправьте JPG/PNG/WebP."));
      mime = k.mime;
      ext = k.ext;
    } else {
      ext = /quicktime/.test(mime) ? "mov" : /webm/.test(mime) ? "webm" : "mp4";
      if (!/^video\//.test(mime)) mime = "video/mp4";
    }
    const url = await storeTelegramFile(bytes, mime, ext);
    if (!url) throw new ApiError(500, "Saqlash xizmati sozlanmagan");
    const att: FileAttachment = { url, name: `telegram.${ext}`, size: bytes.length, type: mime, ...(s.data.duration ? { duration: s.data.duration } : {}) };
    if (asStory) {
      // Story: 24 soat yashaydi, bosh sahifadagi halqada; izoh — story matni
      const { createStory } = await import("@/lib/stories/service");
      await createStory(user.id, { media: att, caption: s.data.caption, bg: null, music: null });
      await clearBotSession(chatId);
      const app = appUrl("/");
      if (msgId) await telegramApi("editMessageText", { chat_id: chatId, message_id: msgId, text: L(lang, "✅ <b>Story joylandi!</b> 24 soat davomida obunachilaringiz halqada ko'radi.", "✅ <b>Story опубликована!</b> 24 часа подписчики увидят её в кольце."), parse_mode: "HTML" });
      const openFeed = L(lang, "Lentani ochish", "Открыть ленту");
      await sendTelegram(chatId, L(lang, "Story'ni ko'rish:", "Посмотреть story:"), { keyboard: [[app ? { text: openFeed, webApp: app } : { text: openFeed, url: `${site()}/` }]] });
      return true;
    }
    const { createProfilePost } = await import("@/lib/profile/posts");
    const post = await createProfilePost(user.id, s.data.caption, [att]);
    await clearBotSession(chatId);
    const sp = await db.query.specialists.findFirst({ where: eq(specialists.userId, user.id), columns: { slug: true } });
    const href = sp ? `/mutaxassislar/${sp.slug}?post=${post.id}` : `/kabinet/postlar`;
    const app = appUrl(href);
    if (msgId) await telegramApi("editMessageText", { chat_id: chatId, message_id: msgId, text: L(lang, "✅ <b>Post joylandi!</b> Obunachilaringizga xabar ketdi.", "✅ <b>Пост опубликован!</b> Подписчикам отправлено уведомление."), parse_mode: "HTML" });
    const openPost = L(lang, "Postni ochish", "Открыть пост");
    await sendTelegram(chatId, L(lang, "Postni ko'rish va tahrirlash:", "Посмотреть и отредактировать пост:"), { keyboard: [[app ? { text: openPost, webApp: app } : { text: openPost, url: `${site()}${href}` }]] });
  } catch (e) {
    await sendTelegram(chatId, `⚠️ ${escapeTelegramHtml(e instanceof ApiError ? e.message : L(lang, `${asStory ? "Story" : "Post"} joylanmadi — keyinroq qayta urinib ko'ring.`, `${asStory ? "Story" : "Пост"} не опубликован — попробуйте позже.`))}`);
  }
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
    { keyboard: [[appUrl("/kabinet/postlar") ? { text: L(lang, "📱 Ilovada yaratish", "📱 Создать в приложении"), webApp: appUrl("/kabinet/postlar")! } : { text: L(lang, "Saytda yaratish", "Создать на сайте"), url: `${site()}/kabinet/postlar` }]] },
  );
}
