import { eq } from "drizzle-orm";
import { handler, ok, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { specialists } from "@/lib/db/schema";
import { getSettings } from "@/lib/payments/settings";
import { plansFor } from "@/lib/subscriptions/billing";
import { getSubscriptionOverview } from "@/lib/subscriptions/queries";

/**
 * O'z obunasi: holat (subscriptions/access.ts — subscriptionState), rejalar narxi bilan, hisoblar tarixi,
 * ulangan to'lov usullari va o'tkazma rekvizitlari. Mijoz uchun — faqat ma'lumot (mijozlar bepul foydalanadi).
 */
export const GET = handler(async () => {
  const session = await requireSession();
  const sp = await db.query.specialists.findFirst({
    where: eq(specialists.userId, session.sub),
    columns: { id: true, userId: true, createdAt: true, subscriptionUntil: true },
  });
  if (!sp) {
    const settings = await getSettings();
    return ok({
      specialist: false as const,
      clientFree: true,
      price: settings.subscriptionPrice,
      trialDays: settings.subscriptionTrialDays,
      plans: plansFor(settings),
    });
  }
  return ok({ specialist: true as const, ...(await getSubscriptionOverview(sp)) });
});
