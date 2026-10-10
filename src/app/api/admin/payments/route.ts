import { handler, ok, requireSession } from "@/lib/api";
import { getAdminFinance, listAdminPayments } from "@/lib/payments/queries";

/** Admin: to'lovlar ro'yxati + moliya jami */
export const GET = handler(async () => {
  await requireSession(["admin"]);
  const [finance, rows] = await Promise.all([getAdminFinance(), listAdminPayments()]);
  return ok({
    finance,
    payments: rows.map((p) => ({
      id: p.id,
      orderId: p.orderId,
      orderTitle: p.order.title,
      orderStatus: p.order.status,
      provider: p.provider,
      state: p.state,
      amount: p.amount,
      commissionPct: p.commissionPct,
      commissionAmount: p.commissionAmount,
      netAmount: p.netAmount,
      providerTxnId: p.providerTxnId,
      createdAt: p.createdAt.getTime(),
      paidAt: p.paidAt?.getTime() ?? null,
      releasedAt: p.releasedAt?.getTime() ?? null,
      client: { name: p.client.name, email: p.client.email },
      specialist: { id: p.specialist.id, slug: p.specialist.slug, name: p.specialist.user.name },
    })),
  });
});
