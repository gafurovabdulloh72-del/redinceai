import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tgChannelGate } from "@/lib/db/schema";
import { sendTelegram, telegramApi } from "@/lib/telegram";
import { L, type BotLang } from "./lang";

/**
 * MAJBURIY OBUNA / KANAL DARVOZASI (2026-11-06) — «kino bot» uslubi.
 *
 * Botdan foydalanish uchun avval rasmiy Kasb Egalari kanaliga obuna bo'lish shart. Obuna bo'lgan odamga
 * HAR harakatda chiqmaydi (a'zolik TTL bilan keshlanadi — `tg_channel_gate`); obunani bekor qilsa, kesh
 * muddati tugagach yana darvoza chiqadi.
 *
 * Sozlash: env `TELEGRAM_REQUIRED_CHANNEL` = `@kanal` (yoki `-100…` id). Bo'lmasa — darvoza O'CHIQ (hamma o'tadi).
 * MUHIM: `getChatMember` ishlashi uchun bot kanalga ADMIN qilib qo'shilishi SHART. Tugmadagi havola uchun
 * kanal `@username` ko'rinishida bo'lgani ma'qul (id bo'lsa `TELEGRAM_REQUIRED_CHANNEL_URL` beriladi).
 */

const OK_TTL_MS = 6 * 60 * 60 * 1000; // a'zo deb 6 soat keshlanadi
const NEG_TTL_MS = 30 * 1000; // yaqinda tekshirilgan «a'zo emas» — 30 s ichida qayta API chaqirmaymiz (faqat xotira keshi)

/** Rasmiy kanal (env). Bo'lsa `@kanal` yoki `-100…`, bo'lmasa null — darvoza o'chiq */
export function requiredChannel(): string | null {
  const c = process.env.TELEGRAM_REQUIRED_CHANNEL?.trim();
  return c || null;
}
export const gateEnabled = (): boolean => Boolean(requiredChannel());

/** Kanalga qo'shilish havolasi: `@username` → t.me/username; aks holda TELEGRAM_REQUIRED_CHANNEL_URL */
function channelUrl(): string | null {
  const explicit = process.env.TELEGRAM_REQUIRED_CHANNEL_URL?.trim();
  if (explicit) return explicit;
  const c = requiredChannel();
  if (c && c.startsWith("@")) return `https://t.me/${c.slice(1)}`;
  return null;
}

/** Qisqa xotira keshi (bitta jarayon ichida) — ketma-ket update'larda bazaga ham bormaslik uchun */
const memo = new Map<string, number>();

/**
 * Chat rasmiy kanalga a'zomi? Kesh (baza TTL + xotira) bilan — a'zo bo'lsa 6 soat API chaqirilmaydi.
 * `force` (Tekshirish tugmasi) — keshni chetlab o'tib darhol so'raydi.
 */
export async function isChannelMember(chatId: string, force = false): Promise<boolean> {
  const channel = requiredChannel();
  if (!channel) return true; // darvoza o'chiq
  const now = Date.now();

  if (!force) {
    const m = memo.get(chatId);
    if (m && m > now) return true;
    try {
      const row = await db.query.tgChannelGate.findFirst({ where: eq(tgChannelGate.chatId, chatId), columns: { okUntil: true } });
      if (row && row.okUntil.getTime() > now) {
        memo.set(chatId, row.okUntil.getTime());
        return true;
      }
    } catch {
      /* baza xatosi — API bilan davom etamiz */
    }
  }

  // Telegram'dan haqiqiy holat
  let member = false;
  try {
    const res = await telegramApi<{ status?: string }>("getChatMember", { chat_id: channel, user_id: Number(chatId) });
    const status = res?.ok ? res.result?.status : undefined;
    member = status === "creator" || status === "administrator" || status === "member";
  } catch {
    // API javob bermasa — foydalanuvchini bloklamaymiz (xavfsiz tomon: darvoza xizmatni buzmasin)
    return true;
  }

  if (member) {
    const until = new Date(now + OK_TTL_MS);
    memo.set(chatId, until.getTime());
    await db.insert(tgChannelGate).values({ chatId, okUntil: until }).onConflictDoUpdate({ target: tgChannelGate.chatId, set: { okUntil: until } }).catch(() => undefined);
  } else {
    // A'zo emas — keshni tozalaymiz (oldin a'zo bo'lgan, keyin chiqgan bo'lishi mumkin)
    memo.delete(chatId);
    memo.set(`neg:${chatId}`, now + NEG_TTL_MS);
    await db.delete(tgChannelGate).where(eq(tgChannelGate.chatId, chatId)).catch(() => undefined);
  }
  return member;
}

const CHANNEL_NAME = "Kasb Egalari";

/** «Avval kanalga obuna bo'ling» darvoza xabari — qo'shilish + «Tekshirish» tugmalari */
export async function sendJoinGate(chatId: string, lang: BotLang = "uz"): Promise<void> {
  const url = channelUrl();
  const text = L(
    lang,
    `🔒 Botdan foydalanish uchun avval rasmiy <b>${CHANNEL_NAME}</b> kanalimizga obuna bo'ling.\n\nObuna bo'lgach «✅ Tekshirish» tugmasini bosing.`,
    `🔒 Чтобы пользоваться ботом, сначала подпишитесь на наш официальный канал <b>${CHANNEL_NAME}</b>.\n\nПосле подписки нажмите «✅ Проверить».`,
  );
  const joinLabel = L(lang, "➕ Kanalga obuna bo'lish", "➕ Подписаться на канал");
  const checkLabel = L(lang, "✅ Tekshirish", "✅ Проверить");
  const keyboard = [
    ...(url ? [[{ text: joinLabel, url }]] : []),
    [{ text: checkLabel, data: "sub:check" }],
  ];
  await sendTelegram(chatId, text, { keyboard });
}

/**
 * «✅ Tekshirish» bosildi: a'zolikni DARHOL (force) qayta tekshiradi.
 * A'zo bo'lsa — true (chaqiruvchi davom etadi), aks holda darvoza yana ko'rsatiladi va false.
 */
export async function handleGateCheck(chatId: string, answer: (t: string) => Promise<unknown>, lang: BotLang = "uz"): Promise<boolean> {
  const ok = await isChannelMember(chatId, true);
  if (ok) {
    await answer(L(lang, "Rahmat! Endi botdan foydalanishingiz mumkin ✅", "Спасибо! Теперь можно пользоваться ботом ✅"));
    return true;
  }
  await answer(L(lang, "Hali obuna bo'lmadingiz. Kanalga qo'shilib, qayta bosing.", "Вы ещё не подписались. Подпишитесь и нажмите снова."));
  await sendJoinGate(chatId, lang);
  return false;
}
