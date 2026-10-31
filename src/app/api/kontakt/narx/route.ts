import { z } from "zod";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { availableProviders } from "@/lib/payments/config";
import { quoteContact } from "@/lib/contacts/unlock";
import { isTelegramEnabled, telegramBotUsername } from "@/lib/telegram";

/** POST {specialistId} — kontakt narxi, holati (ochilganmi) va mavjud to'lov usullari */
export const POST = handler(async (req) => {
  const session = await requireSession();
  const input = await parseBody(req, z.object({ specialistId: z.string().min(1).max(64) }));
  const q = await quoteContact(input.specialistId, session.sub);
  return ok({ ...q, providers: q.amount > 0 ? await availableProviders() : [], telegram: isTelegramEnabled() && Boolean(telegramBotUsername()) });
});
