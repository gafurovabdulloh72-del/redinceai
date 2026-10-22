import { eq } from "drizzle-orm";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createTelegramLinkCode, isTelegramEnabled, telegramBotUsername } from "@/lib/telegram";
import { buyStartPayload } from "@/lib/mentorship/telegram-pay";
import { purchaseQuoteSchema } from "@/lib/mentorship/purchase-schemas";

/**
 * POST — «Telegramda to'lash» havolasi. Chat ulangan bo'lsa to'g'ridan-to'g'ri xarid havolasi (`b_<tur>_<id>`),
 * ulanmagan bo'lsa avval hisobni ulash havolasi ({linked:false}) — ulangach tugmani qayta bosadi.
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  const input = await parseBody(req, purchaseQuoteSchema.pick({ type: true, id: true, promo: true }));
  const username = telegramBotUsername();
  if (!isTelegramEnabled() || !username) throw new ApiError(503, "Telegram bot sozlanmagan");
  const u = await db.query.users.findFirst({ where: eq(users.id, session.sub), columns: { telegramChatId: true } });
  if (u?.telegramChatId) return ok({ linked: true, url: `https://t.me/${username}?start=${buyStartPayload(input.type, input.id, input.promo)}` });
  const code = createTelegramLinkCode(session.sub);
  if (!code) throw new ApiError(500, "Ulash kodini yaratib bo'lmadi");
  return ok({ linked: false, url: `https://t.me/${username}?start=${code}` });
});
