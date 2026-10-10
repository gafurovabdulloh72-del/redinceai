import { handler, ok, requireSession } from "@/lib/api";
import { listAdminPayouts } from "@/lib/payments/queries";

/** Admin: payout so'rovlari (ochiqlari birinchi) */
export const GET = handler(async () => {
  await requireSession(["admin"]);
  const rows = await listAdminPayouts();
  return ok(
    rows.map((p) => ({
      id: p.id,
      amount: p.amount,
      state: p.state,
      method: p.method,
      details: p.details,
      note: p.note,
      createdAt: p.createdAt.getTime(),
      processedAt: p.processedAt?.getTime() ?? null,
      releasedBalance: p.releasedBalance,
      specialist: { id: p.specialist.id, slug: p.specialist.slug, title: p.specialist.title, name: p.specialist.user.name, email: p.specialist.user.email, phone: p.specialist.user.phone },
    })),
  );
});
