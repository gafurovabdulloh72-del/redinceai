import { handler, ok, parseQuery, requireSession } from "@/lib/api";
import { getAdminSubscriptionData } from "@/lib/subscriptions/queries";
import { adminSubscriptionsQuerySchema } from "@/lib/subscriptions/schemas";

/**
 * Admin: obunachilar (holat, muddat, so'nggi to'lov, jami to'langan), filtrlar ?status=active|trial|grace|expired&q=&page=,
 * hisoblar ro'yxati ?invoices=all|pending|paid|refunded|cancelled va jamlanmalar (oy tushumi, MRR, holatlar soni).
 */
export const GET = handler(async (req) => {
  await requireSession(["admin"]);
  const q = parseQuery(req.url, adminSubscriptionsQuerySchema);
  return ok(await getAdminSubscriptionData(q));
});
