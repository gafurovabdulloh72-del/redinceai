import { eq } from "drizzle-orm";
import { ApiError, handler, ok, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { rateLimit } from "@/lib/security/rate-limit";
import { escapeTelegramHtml, isTelegramEnabled, sendTelegramEx } from "@/lib/telegram";
import { L, type BotLang } from "@/lib/telegram-bot/lang";
import { pageButton } from "@/lib/telegram-bot/ui";

/**
 * «Sinov xabari yuborish» (Kabinet → Profil → Telegram): ulangan chatga bitta tekshiruv xabari (foydalanuvchi tilida).
 * Limit: soatiga 5 ta. Bot sozlanmagan yoki hisob ulanmagan bo'lsa — aniq xato.
 */
export const POST = handler(async () => {
  const session = await requireSession();
  if (!isTelegramEnabled()) throw new ApiError(503, "Telegram bot sozlanmagan — administratorga murojaat qiling");
  const u = await db.query.users.findFirst({ where: eq(users.id, session.sub), columns: { telegramChatId: true, name: true, lang: true } });
  if (!u?.telegramChatId) throw new ApiError(409, "Telegram hali ulanmagan — avval «Telegramga ulash»ni bosing");
  await rateLimit(`tgTest:${session.sub}`, 5, 60 * 60_000);
  const lang: BotLang = u.lang === "ru" ? "ru" : "uz";
  const text = L(lang, `<b>Sinov xabari</b>\nSalom, ${escapeTelegramHtml(u.name)}! Kasb Egalari bildirishnomalari shu chatga keladi.`, `<b>Тестовое сообщение</b>\nЗдравствуйте, ${escapeTelegramHtml(u.name)}! Уведомления Kasb Egalari приходят в этот чат.`);
  const sent = await sendTelegramEx(u.telegramChatId, text, { keyboard: [[pageButton(L(lang, "Kabinetni ochish", "Открыть кабинет"), "/kabinet/bildirishnomalar")]] });
  // Botni bloklagan foydalanuvchiga aniq sabab (belgi lib/telegram-bot/reach.ts'da qo'yiladi; botga yozsa — olinadi)
  if (sent.blocked) throw new ApiError(502, "Telegram xabarni qabul qilmadi: botni bloklagansiz yoki hali ishga tushirmagansiz. Botni ochib «Start» bosing va qayta urinib ko'ring");
  if (!sent.ok) throw new ApiError(502, "Telegram xabarni qabul qilmadi — birozdan keyin qayta urinib ko'ring yoki qayta ulang");
  return ok({ sent: true });
});
