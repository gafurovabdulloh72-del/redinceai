import { and, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { orders, payments, payouts, specialists } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { audit } from "@/lib/security/audit";

const schema = z.object({
  isVerified: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
});

/** Admin: tasdiqlash / tavsiya etilganlarga qo'shish (audit jurnaliga yoziladi) */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(["admin"]);
  const { id } = await ctx.params;
  const input = await parseBody(req, schema);
  if (input.isVerified === undefined && input.isFeatured === undefined) throw new ApiError(400, "Hech narsa o'zgarmadi");

  const res = await db.update(specialists).set({ ...input, updatedAt: new Date() }).where(eq(specialists.id, id));
  if (res.rowsAffected === 0) throw new ApiError(404, "Mutaxassis topilmadi");

  if (input.isVerified !== undefined) await audit(session.sub, input.isVerified ? "admin_verify" : "admin_unverify", { targetType: "specialist", targetId: id }, req);
  if (input.isFeatured !== undefined) await audit(session.sub, input.isFeatured ? "admin_feature" : "admin_unfeature", { targetType: "specialist", targetId: id }, req);
  return ok({ id, ...input });
});

/**
 * Admin: profilni o'chirish. orders/payments/payouts jadvallari kaskad bilan o'chadi, shuning uchun
 * pul harakati bo'lgan (eskrouda, o'tkazilgan yoki tasdiq kutayotgan) to'lovlar va ochiq payout
 * so'rovlari bo'lsa o'chirish rad etiladi — moliyaviy yozuvlar yo'qolmasin.
 */
export const DELETE = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(["admin"]);
  const { id } = await ctx.params;
  const sp = await db.query.specialists.findFirst({ where: eq(specialists.id, id), columns: { slug: true, userId: true } });
  if (!sp) throw new ApiError(404, "Mutaxassis topilmadi");

  const [[{ n: ledger }], [{ n: openPayouts }], [{ n: orderCount }]] = await Promise.all([
    db
      .select({ n: count() })
      .from(payments)
      .where(and(eq(payments.specialistId, id), inArray(payments.state, ["pending", "paid", "released"]))),
    db
      .select({ n: count() })
      .from(payouts)
      .where(and(eq(payouts.specialistId, id), inArray(payouts.state, ["requested", "approved"]))),
    db.select({ n: count() }).from(orders).where(eq(orders.specialistId, id)),
  ]);
  if (Number(ledger) > 0 || Number(openPayouts) > 0) {
    throw new ApiError(409, "Mutaxassisda to'lov yozuvlari (eskrou/o'tkazilgan) yoki ochiq payout so'rovlari bor — profilni o'chirib bo'lmaydi. Avval ularni yakunlang");
  }

  await db.delete(specialists).where(eq(specialists.id, id));
  await audit(session.sub, "admin_delete", { targetType: "specialist", targetId: id, meta: { slug: sp.slug, userId: sp.userId, orders: Number(orderCount) } }, req);
  return ok({ deleted: true });
});
