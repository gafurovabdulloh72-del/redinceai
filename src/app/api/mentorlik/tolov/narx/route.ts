import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { enforceLimit } from "@/lib/security/rate-limit";
import { availableProviders } from "@/lib/payments/config";
import { isTelegramEnabled, telegramBotUsername } from "@/lib/telegram";
import { creditBalance, priceFor, quoteItem } from "@/lib/mentorship/purchases";
import { purchaseQuoteSchema } from "@/lib/mentorship/purchase-schemas";

/** POST — narx hisobi (promokod/tavsiya/kredit bilan) va mavjud to'lov usullari */
export const POST = handler(async (req) => {
  const session = await requireSession();
  await enforceLimit("promo", session.sub);
  const input = await parseBody(req, purchaseQuoteSchema);
  const q = await quoteItem(input.type, input.id, session.sub);
  const p = await priceFor(q, session.sub, input);
  return ok({
    title: q.title,
    base: p.base,
    amount: p.amount,
    promo: p.promo ? { code: p.promo.code, percent: p.promo.percent, discount: p.promo.discount } : null,
    ref: p.ref ? { percent: p.ref.percent, discount: p.ref.discount } : null,
    creditUsed: p.creditUsed,
    creditBalance: await creditBalance(session.sub),
    providers: await availableProviders(),
    telegram: isTelegramEnabled() && Boolean(telegramBotUsername()),
  });
});
