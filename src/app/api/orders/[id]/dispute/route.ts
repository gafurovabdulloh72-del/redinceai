import { z } from "zod";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { rateLimit } from "@/lib/security/rate-limit";
import { openDispute } from "@/lib/payments/disputes";
import { loadOrderWithParties } from "@/lib/payments/service";

const schema = z.object({
  reason: z.string().trim().min(10, "Sababni batafsilroq yozing (kamida 10 belgi)").max(1000, "Ko'pi bilan 1000 belgi"),
});

/**
 * Nizo ochish (E56/F19): mijoz yoki mutaxassis — buyurtma jarayonda/yakunlangan va pul eskrouda (paid) bo'lsa.
 * Ochiq nizo tasdiqlash (confirm) va avtomatik release'ni to'xtatadi; admin «release»/«refund» qarorini beradi.
 */
export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const { reason } = await parseBody(req, schema);
  await rateLimit(`dispute:${session.sub}`, 5, 60 * 60 * 1000);

  const order = await loadOrderWithParties(id);
  if (!order) throw new ApiError(404, "Buyurtma topilmadi");
  const isParty = order.clientId === session.sub || order.specialist.userId === session.sub;
  if (!isParty) throw new ApiError(403, "Nizoni faqat buyurtma tomonlari ochadi");

  await openDispute(order, session.sub, reason, req);
  return ok({ id, disputeState: "open" as const, disputeReason: reason, disputeBy: session.sub === order.clientId ? ("client" as const) : ("specialist" as const) });
});
