import "server-only";
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
export async function handleIncomingMedia(chatId: string, media: IncomingMedia, caption: string): Promise<void> {
  const user = await db.query.users.findFirst({ where: eq(users.telegramChatId, chatId), columns: { id: true, role: true, isBanned: true } });
  if (!user || user.isBanned) {
    await sendTelegram(chatId, "Rasm/video joylash uchun avval hisobga ulaning (/start).");
    return;
  }
  if (media.kind === "photo" && (await pendingReceiptInvoice(user.id))) {
    const { handleReceiptPhoto } = await import("@/lib/mentorship/telegram-pay");
    await handleReceiptPhoto(chatId, media.fileId);
    return;
  }
  if (user.role === "client") {
    await sendTelegram(chatId, "Lentaga post faqat mutaxassislar uchun. Ijodkor sifatida ishlasangiz — profilingizda rolni o'zgartiring (Kabinet → Profil).");
    return;
  }
  if (media.size > MAX_BYTES) {
    await sendTelegram(chatId, "Fayl 20 MB dan katta — Telegram boti shunchalik hajmni bera olmaydi. Kattaroq videoni ilovada «Yaratish» orqali yuklang.", { keyboard: [[appUrl("/kabinet/postlar") ? { text: "Ilovada yuklash", webApp: appUrl("/kabinet/postlar")! } : { text: "Saytda yuklash", url: `${site()}/kabinet/postlar` }]] });
    return;
  }
  const cap = caption.trim().slice(0, 2000);
  await setBotSession(chatId, "post", cap ? "confirm" : "caption", { fileId: media.fileId, kind: media.kind, mime: media.mime, size: media.size, caption: cap, duration: media.duration ?? null, width: media.width ?? null, height: media.height ?? null });
  const what = media.kind === "video" ? "🎬 Video" : "🖼 Rasm";
  if (cap) {
    await sendTelegram(chatId, `${what} qabul qilindi.\n<i>${escapeTelegramHtml(cap.slice(0, 200))}${cap.length > 200 ? "…" : ""}</i>\n\n<b>Qayerga joylaymiz?</b> Post — lentaga (obunachilarga bildirishnoma), Story — 24 soatlik halqaga.`, {
      keyboard: [[{ text: "✅ Post qilish", data: "pst:ok" }, { text: "📖 Story qilish", data: "pst:story" }], [{ text: "✍️ Izohni o'zgartirish", data: "pst:cap" }, { text: "✖️ Bekor", data: "pst:no" }]],
    });
  } else {
    await sendTelegram(chatId, `${what} qabul qilindi. <b>Izoh yozing</b> (post matni) yoki izohsiz joylang.`, {
      keyboard: [[{ text: "✅ Izohsiz post", data: "pst:ok" }, { text: "📖 Story qilish", data: "pst:story" }], [{ text: "✖️ Bekor", data: "pst:no" }]],
    });
  }
}

/** Matn — izoh (faqat faol post oqimida, «caption» qadamida) */
export async function handlePostText(chatId: string, text: string): Promise<boolean> {
  const s = await getBotSession<{ fileId: string; kind: "photo" | "video"; caption: string }>(chatId);
  if (!s || s.flow !== "post") return false;
  if (s.step === "caption") {
    const cap = text.trim().slice(0, 2000);
    await setBotSession(chatId, "post", "confirm", { ...s.data, caption: cap });
    await sendTelegram(chatId, `Izoh: <i>${escapeTelegramHtml(cap.slice(0, 200))}${cap.length > 200 ? "…" : ""}</i>\n\n<b>Qayerga joylaymiz?</b>`, {
      keyboard: [[{ text: "✅ Post qilish", data: "pst:ok" }, { text: "📖 Story qilish", data: "pst:story" }], [{ text: "✍️ Izohni o'zgartirish", data: "pst:cap" }, { text: "✖️ Bekor", data: "pst:no" }]],
    });
    return true;
  }
  await sendTelegram(chatId, "Yuqoridagi xabarda «Post qilish» yoki «Bekor» tugmasini bosing 👆");
  return true;
}

/** `pst:*` tugmalari */
export async function handlePostCallback(chatId: string, data: string, answer: (t: string) => Promise<unknown>, msgId: number | null): Promise<boolean> {
  if (!data.startsWith("pst:")) return false;
  const s = await getBotSession<{ fileId: string; kind: "photo" | "video"; mime: string; size: number; caption: string; duration: number | null; width: number | null; height: number | null }>(chatId);
  if (!s || s.flow !== "post") {
    await answer("Fayl eskirgan — rasm/videoni qaytadan yuboring");
    return true;
  }
  if (data === "pst:no") {
    await clearBotSession(chatId);
    await answer("Bekor qilindi");
    if (msgId) await telegramApi("editMessageText", { chat_id: chatId, message_id: msgId, text: "Post bekor qilindi. Yangi rasm/video yuborsangiz — qaytadan taklif qilaman." });
    return true;
  }
  if (data === "pst:cap") {
    await setBotSession(chatId, "post", "caption", s.data);
    await answer("");
    await sendTelegram(chatId, "✍️ Post izohini yozing (2000 belgigacha):");
    return true;
  }
  if (data !== "pst:ok" && data !== "pst:story") return false;
  const asStory = data === "pst:story";
  await answer("Joylanmoqda…");
  const user = await db.query.users.findFirst({ where: eq(users.telegramChatId, chatId), columns: { id: true, role: true } });
  if (!user) return true;
  try {
    const { assertQuota } = await import("@/lib/social/quota");
    await assertQuota(user.id, asStory ? "story" : "post");
    const bytes = await telegramDownloadFile(s.data.fileId, MAX_BYTES);
    if (!bytes) throw new ApiError(400, "Faylni Telegram'dan olib bo'lmadi (20 MB gacha bo'lishi kerak). Qaytadan yuboring.");
    let mime = s.data.mime;
    let ext: string;
    if (s.data.kind === "photo") {
      const k = sniffImage(bytes);
      if (!k) throw new ApiError(400, "Rasm formati tushunarsiz — JPG/PNG/WebP yuboring.");
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
      if (msgId) await telegramApi("editMessageText", { chat_id: chatId, message_id: msgId, text: "✅ <b>Story joylandi!</b> 24 soat davomida obunachilaringiz halqada ko'radi.", parse_mode: "HTML" });
      await sendTelegram(chatId, "Story'ni ko'rish:", { keyboard: [[app ? { text: "Lentani ochish", webApp: app } : { text: "Lentani ochish", url: `${site()}/` }]] });
      return true;
    }
    const { createProfilePost } = await import("@/lib/profile/posts");
    const post = await createProfilePost(user.id, s.data.caption, [att]);
    await clearBotSession(chatId);
    const sp = await db.query.specialists.findFirst({ where: eq(specialists.userId, user.id), columns: { slug: true } });
    const href = sp ? `/mutaxassislar/${sp.slug}?post=${post.id}` : `/kabinet/postlar`;
    const app = appUrl(href);
    if (msgId) await telegramApi("editMessageText", { chat_id: chatId, message_id: msgId, text: "✅ <b>Post joylandi!</b> Obunachilaringizga xabar ketdi.", parse_mode: "HTML" });
    await sendTelegram(chatId, "Postni ko'rish va tahrirlash:", { keyboard: [[app ? { text: "Postni ochish", webApp: app } : { text: "Postni ochish", url: `${site()}${href}` }]] });
  } catch (e) {
    await sendTelegram(chatId, `⚠️ ${escapeTelegramHtml(e instanceof ApiError ? e.message : `${asStory ? "Story" : "Post"} joylanmadi — keyinroq qayta urinib ko'ring.`)}`);
  }
  return true;
}

/** /post — yo'riqnoma */
export async function sendPostHelp(chatId: string): Promise<void> {
  await sendTelegram(chatId, "📸 <b>Bot orqali post va story</b>\nShu chatga rasm yoki video yuboring (20 MB gacha), izohini rasm ostiga yozing — post (lentaga) yoki story (24 soat) sifatida joylashni taklif qilaman.\n\nMusiqa, stikerlar va bir nechta rasm — ilovada «Yaratish» orqali.", {
    keyboard: [[appUrl("/kabinet/postlar") ? { text: "📱 Ilovada yaratish", webApp: appUrl("/kabinet/postlar")! } : { text: "Saytda yaratish", url: `${site()}/kabinet/postlar` }]],
  });
}
