import { eq } from "drizzle-orm";
import { ApiError, handler, ok, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { rateLimit } from "@/lib/security/rate-limit";
import { siteUrl } from "@/lib/security/site";
import { escapeTelegramHtml, isTelegramEnabled, sendTelegram } from "@/lib/telegram";

/**
 * «Sinov xabari yuborish» (Kabinet → Profil → Telegram): ulangan chatga bitta tekshiruv xabari.
 * Limit: soatiga 5 ta. Bot sozlanmagan yoki hisob ulanmagan bo'lsa — aniq xato.
 */
export const POST = handler(async () => {
  const session = await requireSession();
  if (!isTelegramEnabled()) throw new ApiError(503, "Telegram bot sozlanmagan — administratorga murojaat qiling");
  const u = await db.query.users.findFirst({ where: eq(users.id, session.sub), columns: { telegramChatId: true, name: true } });
  if (!u?.telegramChatId) throw new ApiError(409, "Telegram hali ulanmagan — avval «Telegramga ulash»ni bosing");
  await rateLimit(`tgTest:${session.sub}`, 5, 60 * 60_000);
  const origin = siteUrl() ?? (process.env.NODE_ENV !== "production" ? `http://localhost:${process.env.PORT || 3000}` : null);
  const text = `<b>Sinov xabari</b>\nSalom, ${escapeTelegramHtml(u.name)}! Kasb Egalari bildirishnomalari shu chatga keladi.`;
  const sent = await sendTelegram(u.telegramChatId, text, origin ? { button: { text: "Kabinetni ochish", url: `${origin}/kabinet/bildirishnomalar` } } : {});
  if (!sent) throw new ApiError(502, "Telegram xabarni qabul qilmadi — botni bloklamaganingizni tekshiring yoki qayta ulang");
  return ok({ sent: true });
});
