import { eq } from "drizzle-orm";
import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { enforceLimit } from "@/lib/security/rate-limit";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createTelegramLinkCode, isTelegramEnabled, telegramBotUsername } from "@/lib/telegram";
import { quoteContact } from "@/lib/contacts/unlock";

/**
 * POST {specialistId} — «Telegramda to'lash» havolasi (kontakt ochish). Chat ulangan bo'lsa `b_x_<specialistId>` deep link
 * (bot narx + usul tugmalarini beradi — lib/telegram-bot/contact-pay.ts), ulanmagan bo'lsa avval ulash havolasi ({linked:false}).
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  await enforceLimit("purchase", session.sub);
  const input = await parseBody(req, z.object({ specialistId: z.string().min(1).max(48) }));
  const username = telegramBotUsername();
  if (!isTelegramEnabled() || !username) throw new ApiError(503, "Telegram bot sozlanmagan");
  await quoteContact(input.specialistId, session.sub); // 404/403 tekshiruvlari (sotilmaydigan/yo'q profil)
  const u = await db.query.users.findFirst({ where: eq(users.id, session.sub), columns: { telegramChatId: true } });
  if (u?.telegramChatId) return ok({ linked: true, url: `https://t.me/${username}?start=b_x_${input.specialistId}` });
  const code = createTelegramLinkCode(session.sub);
  if (!code) throw new ApiError(500, "Ulash kodini yaratib bo'lmadi");
  return ok({ linked: false, url: `https://t.me/${username}?start=${code}` });
});
