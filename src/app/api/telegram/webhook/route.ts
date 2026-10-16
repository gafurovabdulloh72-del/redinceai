import { timingSafeEqual } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { sendTelegram, telegramWebhookSecret, verifyTelegramLinkCode } from "@/lib/telegram";

/**
 * Telegram Bot API webhook (setWebhook bilan o'rnatiladi — docs/DEPLOY.md §11).
 *
 * Xavfsizlik: `x-telegram-bot-api-secret-token` sarlavhasi TELEGRAM_WEBHOOK_SECRET ga teng bo'lishi SHART
 * (aks holda 401). Tekshiruvdan o'tgan so'rovga HAR DOIM 200 qaytadi — ichki xato Telegram'ning retry
 * bo'ronini keltirib chiqarmasin (xato faqat logga yoziladi).
 *
 * Faqat shaxsiy chatdagi matnli xabarlar:
 *   /start <kod> — hisobni ulash (kod: /api/telegram/link, 15 daqiqa amal qiladi)
 *   /stop        — shu chatga ulangan hisobdan uzish
 *   boshqa matn  — qisqa yordam
 */

const HELP_TEXT =
  "Bu bot — <b>Kasb Egalari</b> bildirishnomalari (buyurtma, to'lov, xabarlar).\n" +
  "Hisobni ulash: saytda Kabinet → Profil → «Telegramga ulash».\n" +
  "Uzish: /stop";

function secretOk(req: Request): boolean {
  // Sir env'dan yoki AUTH_SECRET'dan avtomatik (telegramWebhookSecret) — admin paneldagi
  // "Webhookni o'rnatish" ham aynan shu qiymat bilan setWebhook qiladi
  const expected = process.env.TELEGRAM_BOT_TOKEN ? telegramWebhookSecret() : "";
  const got = req.headers.get("x-telegram-bot-api-secret-token") || "";
  if (!expected || got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

/** Telegram update'ining bizga kerakli qismi (to'liq tip shart emas) */
interface TelegramUpdate {
  message?: {
    text?: unknown;
    chat?: { id?: unknown; type?: unknown };
  };
}

async function handleStart(chatId: string, code: string): Promise<void> {
  const userId = code ? verifyTelegramLinkCode(code) : null;
  if (!userId) {
    await sendTelegram(chatId, "Kod noto'g'ri yoki eskirgan (15 daqiqa amal qiladi). Saytda Kabinet → Profil → «Telegramga ulash» orqali yangi havola oling.");
    return;
  }
  // Bitta chat — bitta hisob: shu chatId boshqa foydalanuvchida bo'lsa, avval undan uzamiz
  await db
    .update(users)
    .set({ telegramChatId: null })
    .where(and(eq(users.telegramChatId, chatId), ne(users.id, userId)));
  const [row] = await db.update(users).set({ telegramChatId: chatId }).where(eq(users.id, userId)).returning({ id: users.id });
  if (!row) {
    await sendTelegram(chatId, "Hisob topilmadi. Saytdan qayta urinib ko'ring: Kabinet → Profil → «Telegramga ulash».");
    return;
  }
  await sendTelegram(chatId, "✅ Kasb Egalari hisobingiz ulandi. Endi buyurtma va xabarlar shu yerga keladi.");
}

async function handleStop(chatId: string): Promise<void> {
  const res = await db.update(users).set({ telegramChatId: null }).where(eq(users.telegramChatId, chatId));
  if (res.rowsAffected > 0) {
    await sendTelegram(chatId, "Telegram bildirishnomalari uzildi. Qayta ulash: saytda Kabinet → Profil → «Telegramga ulash».");
  } else {
    await sendTelegram(chatId, "Bu chat hech qaysi hisobga ulanmagan edi. Ulash: saytda Kabinet → Profil → «Telegramga ulash».");
  }
}

export async function POST(req: Request) {
  if (!secretOk(req)) return Response.json({ ok: false }, { status: 401 });
  try {
    const update = (await req.json()) as TelegramUpdate;
    const msg = update?.message;
    const chatId = msg?.chat?.id != null ? String(msg.chat.id) : "";
    const text = typeof msg?.text === "string" ? msg.text.trim() : "";
    // Faqat shaxsiy chat: guruhga qo'shilgan botdagi buyruqlar e'tiborga olinmaydi
    if (!chatId || !text || msg?.chat?.type !== "private") return Response.json({ ok: true });

    const [rawCmd = "", arg = ""] = text.split(/\s+/);
    const cmd = rawCmd.split("@")[0].toLowerCase(); // "/start@BotNomi" ham qabul qilinadi
    if (cmd === "/start") await handleStart(chatId, arg);
    else if (cmd === "/stop") await handleStop(chatId);
    else await sendTelegram(chatId, HELP_TEXT);
  } catch (e) {
    // Har doim 200 — Telegram xatoli javobni qayta-qayta yuborib turadi
    console.error("[telegram:webhook]", e);
  }
  return Response.json({ ok: true });
}

export function GET() {
  return Response.json({ ok: false, error: "Faqat POST" }, { status: 405 });
}
