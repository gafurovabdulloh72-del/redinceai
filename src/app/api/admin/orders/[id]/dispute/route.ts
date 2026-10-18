import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { orderEvents } from "@/lib/db/schema";
import { handler, ok, parseBody, requireSession } from "@/lib/api";
import { DISPUTE_RESOLUTIONS, resolveDispute } from "@/lib/payments/disputes";

const schema = z.object({
  resolution: z.enum(DISPUTE_RESOLUTIONS),
  /** Qaror izohi majburiy (kamida 5 belgi) — tomonlar sababsiz qaror olmasin */
  note: z.string().trim().min(5, "Kamida 5 belgi").max(500, "Ko'pi bilan 500 belgi"),
});

/**
 * Admin: nizo bo'yicha buyurtma jurnali (order_events) — qaror oldidan tarixni ochmasdan ko'rish uchun.
 * Faqat o'qish; tomonlar ko'radigan jurnalning o'zi (holat, narx, to'lov, nizo, izoh).
 */
export const GET = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  await requireSession(["admin"]);
  const { id } = await ctx.params;
  const events = await db.query.orderEvents.findMany({
    where: eq(orderEvents.orderId, id),
    orderBy: [asc(orderEvents.createdAt)],
    limit: 100,
    with: { actor: { columns: { name: true } } },
  });
  return ok(
    events.map((e) => ({
      id: e.id,
      type: e.type,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      note: e.note,
      actor: e.actor?.name ?? null,
      createdAt: e.createdAt.getTime(),
    })),
  );
});

/** Admin nizo qarori: release — eskrou mutaxassisga; refund — mijozga qaytariladi. Izoh majburiy. Tomonlarga bildirishnoma + jurnal. */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(["admin"]);
  const { id } = await ctx.params;
  const { resolution, note } = await parseBody(req, schema);
  const result = await resolveDispute(id, session.sub, resolution, note.trim(), req);
  return ok({ id, disputeState: "resolved" as const, resolution: result.resolution });
});
