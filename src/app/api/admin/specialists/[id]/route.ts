import { and, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { orders, payments, payouts, specialists } from "@/lib/db/schema";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { notify } from "@/lib/notifications";
import { audit } from "@/lib/security/audit";

const schema = z.object({
  isVerified: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  /** "reject" — profil katalogga qo'shilmaydi (isHidden), egasiga sabab bilan bildirishnoma boradi */
  action: z.literal("reject").optional(),
  reason: z.string().trim().min(5, "Kamida 5 belgi").max(300, "Ko'pi bilan 300 belgi").optional(),
});

/** Admin: tasdiqlash / tavsiya etilganlarga qo'shish / rad etish (hammasi audit jurnaliga yoziladi) */
export const PATCH = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(["admin"]);
  const { id } = await ctx.params;
  const input = await parseBody(req, schema);

  // Rad etish: profil o'chmaydi — katalogdan yashiriladi, egasi sababni ko'radi va tuzatib qayta yuboradi
  if (input.action === "reject") {
    const reason = input.reason?.trim() ?? "";
    if (reason.length < 5) throw new ApiError(422, "Rad etish sababini yozing (kamida 5 belgi)", { reason: "Kamida 5 belgi" });
    const sp = await db.query.specialists.findFirst({ where: eq(specialists.id, id), columns: { userId: true, slug: true } });
    if (!sp) throw new ApiError(404, "Mutaxassis topilmadi");
    await db.update(specialists).set({ isHidden: true, updatedAt: new Date() }).where(eq(specialists.id, id));
    await audit(session.sub, "admin_profile_rejected", { targetType: "specialist", targetId: id, meta: { reason, slug: sp.slug, userId: sp.userId } }, req);
    await notify(sp.userId, "account", "Profil hozircha katalogga qo'shilmadi", `Profil hozircha katalogga qo'shilmadi: ${reason}`, "/kabinet/profil");
    return ok({ id, rejected: true, isHidden: true });
  }

  if (input.isVerified === undefined && input.isFeatured === undefined) throw new ApiError(400, "Hech narsa o'zgarmadi");

  const res = await db
    .update(specialists)
    .set({ ...(input.isVerified !== undefined ? { isVerified: input.isVerified } : {}), ...(input.isFeatured !== undefined ? { isFeatured: input.isFeatured } : {}), updatedAt: new Date() })
    .where(eq(specialists.id, id));
  if (res.rowsAffected === 0) throw new ApiError(404, "Mutaxassis topilmadi");

  if (input.isVerified !== undefined) {
    await audit(session.sub, input.isVerified ? "admin_verify" : "admin_unverify", { targetType: "specialist", targetId: id }, req);
    // Tasdiq olib tashlanganda egasi bilsin — profil yana tekshiruv navbatiga qaytadi
    if (input.isVerified === false) {
      const sp = await db.query.specialists.findFirst({ where: eq(specialists.id, id), columns: { userId: true } });
      if (sp) await notify(sp.userId, "account", "Profil tasdig'i olib tashlandi", "Profil tasdig'i olib tashlandi — ma'lumotlarni yangilang, admin qayta ko'rib chiqadi.", "/kabinet/profil");
    }
  }
  if (input.isFeatured !== undefined) await audit(session.sub, input.isFeatured ? "admin_feature" : "admin_unfeature", { targetType: "specialist", targetId: id }, req);
  return ok({ id, isVerified: input.isVerified, isFeatured: input.isFeatured });
});

/**
 * Admin: profilni o'chirish. orders/payments/payouts jadvallari kaskad bilan o'chadi, shuning uchun
 * HAR QANDAY holatdagi to'lov yozuvi (hatto bekor qilingan/qaytarilgan ham — moliyaviy tarix) yoki
 * ochiq payout so'rovi bo'lsa o'chirish rad etiladi — moliyaviy yozuvlar yo'qolmasin.
 */
export const DELETE = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession(["admin"]);
  const { id } = await ctx.params;
  const sp = await db.query.specialists.findFirst({ where: eq(specialists.id, id), columns: { slug: true, userId: true } });
  if (!sp) throw new ApiError(404, "Mutaxassis topilmadi");

  const [[{ n: ledger }], [{ n: openPayouts }], [{ n: orderCount }]] = await Promise.all([
    // Istalgan holatdagi to'lov yozuvi o'chirishni bloklaydi (bekor qilingan/qaytarilgan ham tarix)
    db.select({ n: count() }).from(payments).where(eq(payments.specialistId, id)),
    db
      .select({ n: count() })
      .from(payouts)
      .where(and(eq(payouts.specialistId, id), inArray(payouts.state, ["requested", "approved"]))),
    db.select({ n: count() }).from(orders).where(eq(orders.specialistId, id)),
  ]);
  if (Number(ledger) > 0 || Number(openPayouts) > 0) {
    throw new ApiError(409, "Mutaxassisda to'lov yozuvlari bor — moliyaviy tarix o'chirilmaydi. O'rniga foydalanuvchini bloklang va profilni katalogdan yashiring");
  }

  await db.delete(specialists).where(eq(specialists.id, id));
  await audit(session.sub, "admin_delete", { targetType: "specialist", targetId: id, meta: { slug: sp.slug, userId: sp.userId, orders: Number(orderCount) } }, req);
  return ok({ deleted: true });
});
