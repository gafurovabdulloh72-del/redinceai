import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { specialists } from "@/lib/db/schema";
import { handler, ok, requireSession } from "@/lib/api";
import { listPaymentsForClient, listPaymentsForSpecialist } from "@/lib/payments/queries";

/** Joriy foydalanuvchining to'lovlari: mijoz sifatida (to'lagan) + mutaxassis sifatida (olgan) */
export const GET = handler(async () => {
  const session = await requireSession();
  const sp = await db.query.specialists.findFirst({ where: eq(specialists.userId, session.sub), columns: { id: true } });
  const [asClient, asSpecialist] = await Promise.all([listPaymentsForClient(session.sub), sp ? listPaymentsForSpecialist(sp.id) : Promise.resolve([])]);
  const map = (p: (typeof asClient)[number] | (typeof asSpecialist)[number]) => ({
    id: p.id,
    orderId: p.orderId,
    orderTitle: p.order.title,
    provider: p.provider,
    state: p.state,
    amount: p.amount,
    commissionPct: p.commissionPct,
    commissionAmount: p.commissionAmount,
    netAmount: p.netAmount,
    createdAt: p.createdAt.getTime(),
    paidAt: p.paidAt?.getTime() ?? null,
    releasedAt: p.releasedAt?.getTime() ?? null,
  });
  return ok({ asClient: asClient.map(map), asSpecialist: asSpecialist.map(map) });
});
