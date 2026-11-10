import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { subscriptionInvoices, tgChannelGate, users } from "@/lib/db/schema";
import { sendTelegram, telegramApi } from "@/lib/telegram";
import { clearBotSession, getBotSession, setBotSession } from "@/lib/telegram-bot/session";
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
 *
 * XAVFSIZ TOMON (2026-11-10 tuzatildi): Telegram javob bermasa yoki rad etsa (vaqt tugadi, 429, bot kanalda admin emas)
 * darvoza OCHIQ qoladi — `telegramApi` xato tashlamaydi (null / {ok:false} qaytaradi), ilgari bu «a'zo emas» deb
 * o'qilib, hamma foydalanuvchi qulflanib qolardi. Bunday holatda adminlarga bitta ogohlantirish ketadi (6 soatda bir).
 */

const OK_TTL_MS = 6 * 60 * 60 * 1000; // a'zo deb 6 soat keshlanadi
const NEG_TTL_MS = 30 * 1000; // yaqinda tekshirilgan «a'zo emas» — 30 s ichida qayta API chaqirmaymiz (faqat xotira keshi)
const ALERT_DEDUPE_MS = 6 * 60 * 60 * 1000;

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

/** Qisqa xotira keshi (bitta jarayon ichida): `ok` — a'zo (shu vaqtgacha), `no` — a'zo emas (shu vaqtgacha qayta so'ralmaydi) */
const flag = globalThis as { __redinceTgGate?: { ok: Map<string, number>; no: Map<string, number> } };
const memo = () => (flag.__redinceTgGate ??= { ok: new Map(), no: new Map() });

/** Darvoza ishlamayapti (Telegram rad etdi / javob bermadi) — adminlarga bir marta (6 soatda) xabar; foydalanuvchiga hech narsa aytilmaydi */
async function alertGateBroken(why: string): Promise<void> {
  try {
    const { notifyAdmins } = await import("@/lib/notifications");
    await notifyAdmins(
      "account",
      "Bot: majburiy obuna tekshiruvi ishlamayapti",
      `Kanal a'zoligini tekshirib bo'lmadi (${why.slice(0, 120)}). Hozircha hamma foydalanuvchi darvozasiz o'tmoqda. Bot kanalda administrator ekanini va TELEGRAM_REQUIRED_CHANNEL qiymatini tekshiring.`,
      "/admin#telegram-bot",
      { skipMail: true, dedupeMs: ALERT_DEDUPE_MS },
    );
  } catch (e) {
    console.error("[telegram:gate] ogohlantirish", e instanceof Error ? e.message : e);
  }
}

/**
 * Chat rasmiy kanalga a'zomi? Kesh (baza TTL + xotira) bilan — a'zo bo'lsa 6 soat API chaqirilmaydi; «a'zo emas» javobi
 * 30 soniya xotirada turadi (obuna bo'lmagan odamning har xabari Telegram'ga so'rov yubormasin).
 * `force` (Tekshirish tugmasi) — keshni chetlab o'tib darhol so'raydi.
 */
export async function isChannelMember(chatId: string, force = false): Promise<boolean> {
  const channel = requiredChannel();
  if (!channel) return true; // darvoza o'chiq
  const now = Date.now();
  const m = memo();

  if (!force) {
    const okUntil = m.ok.get(chatId);
    if (okUntil && okUntil > now) return true;
    const noUntil = m.no.get(chatId);
    if (noUntil && noUntil > now) return false;
    try {
      const row = await db.query.tgChannelGate.findFirst({ where: eq(tgChannelGate.chatId, chatId), columns: { okUntil: true } });
      if (row && row.okUntil.getTime() > now) {
        m.ok.set(chatId, row.okUntil.getTime());
        return true;
      }
    } catch {
      /* baza xatosi — API bilan davom etamiz */
    }
  }

  // Telegram'dan haqiqiy holat. `telegramApi` THROW QILMAYDI: null — tarmoq/vaqt xatosi, {ok:false} — Telegram rad etdi
  const res = await telegramApi<{ status?: string }>("getChatMember", { chat_id: channel, user_id: Number(chatId) });
  if (!res || !res.ok) {
    // Xavfsiz tomon: tekshirib bo'lmadi — foydalanuvchini bloklamaymiz (kesh yozilmaydi: keyingi safar yana so'raladi)
    await alertGateBroken(res ? (res.description ?? "Telegram rad etdi") : "Telegram javob bermadi");
    return true;
  }
  const status = res.result?.status;
  // «restricted» — kanalda cheklangan, lekin a'zo (is_member tekshirilmaydi: kanallarda bu holat deyarli uchramaydi)
  const member = status === "creator" || status === "administrator" || status === "member" || status === "restricted";

  if (member) {
    const until = new Date(now + OK_TTL_MS);
    m.ok.set(chatId, until.getTime());
    m.no.delete(chatId);
    await db.insert(tgChannelGate).values({ chatId, okUntil: until }).onConflictDoUpdate({ target: tgChannelGate.chatId, set: { okUntil: until } }).catch(() => undefined);
  } else {
    // A'zo emas — keshni tozalaymiz (oldin a'zo bo'lgan, keyin chiqqan bo'lishi mumkin)
    m.ok.delete(chatId);
    m.no.set(chatId, now + NEG_TTL_MS);
    await db.delete(tgChannelGate).where(eq(tgChannelGate.chatId, chatId)).catch(() => undefined);
  }
  return member;
}

/**
 * Darvozadan ISTISNO holatlar (a'zo bo'lmasa ham o'tadi) — saytdan boshlangan oqimning KEYINGI qadamlari. Istisno tor:
 *  - `flow`: faol ro'yxatdan o'tish oqimi (`/start l_<kod>` hisobsiz chatni ro'yxatga yuboradi) — faqat oqimning
 *    o'z javoblari (ism/telefon matni, kontakt, `rg:` tugmalari); buyruqlar baribir darvozadan o'tadi;
 *  - `receipt`: ochiq qo'lda-o'tkazma hisobi (`/start b_…` → «Karta o'tkazmasi») — faqat rasm/hujjat (chek).
 * Bularsiz foydalanuvchi to'lovni boshlab chekni, yoki ro'yxatni boshlab ismini yubora olmay qolardi.
 */
export async function gateExempt(chatId: string, what: "flow" | "receipt"): Promise<boolean> {
  try {
    if (what === "flow") return (await getBotSession(chatId))?.flow === "register";
    const u = await db.query.users.findFirst({ where: eq(users.telegramChatId, chatId), columns: { id: true } });
    if (!u) return false;
    const open = await db.query.subscriptionInvoices.findFirst({
      where: and(eq(subscriptionInvoices.userId, u.id), eq(subscriptionInvoices.provider, "manual"), inArray(subscriptionInvoices.state, ["created", "pending"])),
      orderBy: [desc(subscriptionInvoices.createdAt)],
      columns: { id: true },
    });
    return Boolean(open);
  } catch {
    // Tekshirib bo'lmadi — xavfsiz tomon: o'tkazamiz
    return true;
  }
}

/** Darvoza to'xtatgan `/start <payload>` (ulash kodi, `reg` …) — obunadan keyin «Tekshirish» bosilganda qayta ijro etiladi */
export async function rememberGatedStart(chatId: string, payload: string): Promise<void> {
  if (!payload || payload.length > 64) return;
  await setBotSession(chatId, "gate", "start", { start: payload }).catch(() => undefined);
}
/** Saqlangan `/start` payloadini olib, o'chiradi (yo'q bo'lsa null) */
export async function takeGatedStart(chatId: string): Promise<string | null> {
  try {
    const s = await getBotSession<{ start?: string }>(chatId);
    if (s?.flow !== "gate") return null;
    await clearBotSession(chatId);
    return typeof s.data.start === "string" && s.data.start ? s.data.start : null;
  } catch {
    return null;
  }
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
