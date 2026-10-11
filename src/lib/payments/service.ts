import "server-only";
import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, payments, type Order, type Payment } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import type { PaymentProvider } from "@/lib/constants";
import { notify, notifyAdmins } from "@/lib/notifications";
import { audit } from "@/lib/security/audit";
import { formatPrice, uid } from "@/lib/utils";
import { isProviderConfigured, paymentsEnv } from "./config";
import { getSettings, splitAmount } from "./settings";

/* ------------------------------------------------------------------ */
/* Yordamchilar                                                        */
/* ------------------------------------------------------------------ */
export const ACTIVE_PAYMENT_STATES = ["created", "pending"] as const;
export const orderHref = (orderId: string) => `/kabinet/buyurtmalar?id=${orderId}`;

/** Buyurtma + tomonlar (to'lov oqimida bildirishnoma yuborish uchun) */
export async function loadOrderWithParties(orderId: string) {
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: {
      client: { columns: { id: true, name: true } },
      specialist: { columns: { id: true, userId: true, slug: true, title: true }, with: { user: { columns: { name: true, avatarUrl: true } } } },
    },
  });
  return order ?? null;
}
export type OrderWithParties = NonNullable<Awaited<ReturnType<typeof loadOrderWithParties>>>;

/** To'lovga tayyor buyurtma: narx belgilangan, to'lov kutilmoqda, bekor qilinmagan */
export function isPayable(order: Pick<Order, "status" | "paymentState" | "amount">): boolean {
  return order.status !== "cancelled" && order.paymentState === "awaiting" && Boolean(order.amount && order.amount > 0);
}

/** Provayder (Payme/Click) tomonida jarayondagi to'lov: 'pending' va 12 soatdan eskirmagan */
export const PROVIDER_PENDING_TTL_MS = 12 * 60 * 60 * 1000;
export async function findInFlightProviderPayment(orderId: string): Promise<Payment | null> {
  const rows = await db.query.payments.findMany({
    where: and(eq(payments.orderId, orderId), eq(payments.state, "pending"), inArray(payments.provider, ["payme", "click"])),
  });
  const now = Date.now();
  return rows.find((p) => now - (p.providerCreateTime ?? p.createdAt.getTime()) <= PROVIDER_PENDING_TTL_MS) ?? null;
}

/* ------------------------------------------------------------------ */
/* Yo'naltirish havolalari                                             */
/* ------------------------------------------------------------------ */
export function returnUrl(origin: string, paymentId: string) {
  return `${origin}/tolov/natija?payment=${encodeURIComponent(paymentId)}`;
}

/**
 * Provayder checkout havolasi.
 *  Payme: https://checkout.paycom.uz/<base64("m=…;ac.order_id=…;a=<tiyin>;c=<return>;l=uz")>
 *  Click: https://my.click.uz/services/pay?service_id&merchant_id&amount=<so'm.00>&transaction_param=<orderId>&return_url
 *  Manual: null (rekvizitlar ko'rsatiladi)
 */
export function buildRedirectUrl(payment: Pick<Payment, "id" | "orderId" | "amount" | "provider">, origin: string): string | null {
  const env = paymentsEnv();
  const back = returnUrl(origin, payment.id);
  if (payment.provider === "payme") {
    if (!env.payme.merchantId) return null;
    const params = `m=${env.payme.merchantId};ac.order_id=${payment.orderId};a=${payment.amount * 100};c=${back};l=uz`;
    return env.payme.checkoutUrl + Buffer.from(params, "utf8").toString("base64");
  }
  if (payment.provider === "click") {
    if (!env.click.serviceId || !env.click.merchantId) return null;
    const q = new URLSearchParams({
      service_id: env.click.serviceId,
      merchant_id: env.click.merchantId,
      amount: payment.amount.toFixed(2),
      transaction_param: payment.orderId,
      return_url: back,
    });
    if (env.click.merchantUserId) q.set("merchant_user_id", env.click.merchantUserId);
    return `https://my.click.uz/services/pay?${q.toString()}`;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Checkout: mijoz to'lovni boshlaydi                                  */
/* ------------------------------------------------------------------ */
export async function createCheckout(opts: { order: OrderWithParties; provider: PaymentProvider; actorId: string; origin: string; req?: Request }) {
  const { order, provider } = opts;
  if (!isProviderConfigured(provider)) throw new ApiError(400, "Bu to'lov usuli hozircha ulanmagan");
  if (order.status === "cancelled") throw new ApiError(400, "Bekor qilingan buyurtma uchun to'lov qilib bo'lmaydi");
  if (order.paymentState === "paid" || order.paymentState === "released") throw new ApiError(400, "Bu buyurtma allaqachon to'langan");
  if (!isPayable(order) || !order.amount) throw new ApiError(400, "Avval mutaxassis narx belgilashi kerak");

  // Provayder tomonida jarayondagi tranzaksiya bo'lsa — ikkinchi to'lov ochilmaydi
  const inFlight = await findInFlightProviderPayment(order.id);
  if (inFlight) {
    if (inFlight.provider === provider) return { payment: inFlight, redirectUrl: buildRedirectUrl(inFlight, opts.origin) };
    throw new ApiError(409, "Bu buyurtma uchun boshqa usul orqali to'lov jarayonda. Avval uni yakunlang yoki bekor bo'lishini kuting");
  }

  const settings = await getSettings();
  const pct = order.commissionPct ?? settings.commissionPct;
  const { commissionAmount, netAmount } = splitAmount(order.amount, pct);

  // Shu provayder bo'yicha ochiq (hali provayderga yuborilmagan) to'lov bo'lsa — qayta ishlatamiz.
  // Qo'lda o'tkazmada «To'ladim» bosilgan (pending) yozuv ham qayta ishlatiladi — ikkinchi so'rov ochilmaydi.
  const existing = await db.query.payments.findFirst({
    where: and(eq(payments.orderId, order.id), eq(payments.provider, provider), inArray(payments.state, provider === "manual" ? ["created", "pending"] : ["created"])),
  });

  let payment: Payment;
  if (existing?.state === "pending") {
    payment = existing;
  } else if (existing) {
    const [row] = await db
      .update(payments)
      .set({ amount: order.amount, commissionPct: pct, commissionAmount, netAmount, updatedAt: new Date() })
      .where(eq(payments.id, existing.id))
      .returning();
    payment = row;
  } else {
    const [row] = await db
      .insert(payments)
      .values({
        id: uid(),
        orderId: order.id,
        clientId: order.clientId,
        specialistId: order.specialistId,
        amount: order.amount,
        commissionPct: pct,
        commissionAmount,
        netAmount,
        provider,
        state: "created",
        meta: {},
      })
      .returning();
    payment = row;
    await audit(opts.actorId, "payment_created", { targetType: "payment", targetId: payment.id, meta: { orderId: order.id, provider, amount: order.amount } }, opts.req);
  }

  return { payment, redirectUrl: buildRedirectUrl(payment, opts.origin) };
}

/** Qo'lda o'tkazma: mijoz "To'ladim" bosdi → pending, admin tasdiqlaydi */
export async function markManualSent(payment: Payment, actorId: string, req?: Request): Promise<Payment> {
  if (payment.provider !== "manual") throw new ApiError(400, "Bu to'lov provayder orqali tasdiqlanadi");
  if (payment.state === "pending") return payment;
  if (payment.state !== "created") throw new ApiError(400, "To'lov holati o'zgartirib bo'lmaydi");
  const [row] = await db
    .update(payments)
    .set({ state: "pending", providerTxnId: payment.providerTxnId ?? `manual-${payment.id.slice(0, 8)}`, updatedAt: new Date() })
    .where(eq(payments.id, payment.id))
    .returning();
  const order = await loadOrderWithParties(payment.orderId);
  await notifyAdmins(
    "payment_pending",
    "Qo'lda o'tkazma tasdiqlashni kutmoqda",
    order ? `${order.client.name} — «${order.title}» uchun ${formatPrice(payment.amount)} o'tkazganini bildirdi.` : null,
    "/admin#tolovlar",
  );
  await audit(actorId, "payment_created", { targetType: "payment", targetId: payment.id, meta: { manualSent: true } }, req);
  return row;
}

/* ------------------------------------------------------------------ */
/* Holat o'zgarishlari                                                 */
/* ------------------------------------------------------------------ */
export interface PaidExtra {
  providerTxnId?: string | null;
  providerState?: number | null;
  performTime?: number | null;
  actorId?: string | null;
  req?: Request;
}

/**
 * To'lov qabul qilindi (eskrou). Idempotent: allaqachon paid/released bo'lsa — o'zgarmaydi.
 * Buyurtma: paymentState 'paid', komissiya foizi snapshot. Shu buyurtmaning boshqa ochiq to'lovlari bekor qilinadi.
 */
export async function markPaid(paymentId: string, extra: PaidExtra = {}): Promise<Payment> {
  const current = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
  if (!current) throw new ApiError(404, "To'lov topilmadi");
  if (current.state === "paid" || current.state === "released") return current;
  if (current.state === "refunded") throw new ApiError(400, "Qaytarilgan to'lovni qayta tasdiqlab bo'lmaydi");

  const now = new Date();
  // Holatga bog'liq yangilash: parallel PerformTransaction/Complete chaqiruvlarida faqat bittasi "paid" yo'lidan o'tadi
  const [row] = await db
    .update(payments)
    .set({
      state: "paid",
      paidAt: now,
      updatedAt: now,
      providerState: extra.providerState ?? current.providerState ?? null,
      performTime: extra.performTime ?? current.performTime ?? now.getTime(),
      ...(extra.providerTxnId ? { providerTxnId: extra.providerTxnId } : {}),
    })
    .where(and(eq(payments.id, paymentId), inArray(payments.state, [...ACTIVE_PAYMENT_STATES])))
    .returning();
  if (!row) {
    const fresh = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
    if (fresh && (fresh.state === "paid" || fresh.state === "released")) return fresh;
    throw new ApiError(409, "To'lov holati o'zgargan — qayta tasdiqlab bo'lmaydi");
  }

  await db
    .update(orders)
    .set({ paymentState: "paid", commissionPct: row.commissionPct, updatedAt: now })
    .where(eq(orders.id, row.orderId));

  // Boshqa provayder orqali boshlangan, hali to'lanmagan urinishlar (Payme/Click uchun holat -1 deb qaytariladi)
  await db
    .update(payments)
    .set({ state: "cancelled", providerState: -1, cancelTime: now.getTime(), cancelReason: 4, updatedAt: now })
    .where(and(eq(payments.orderId, row.orderId), ne(payments.id, row.id), inArray(payments.state, [...ACTIVE_PAYMENT_STATES])));

  const order = await loadOrderWithParties(row.orderId);
  if (order) {
    await notify(
      order.specialist.userId,
      "order_paid",
      `Mijoz to'ladi: ${formatPrice(row.amount)}`,
      `«${order.title}» — pul eskrouda. Ishni yakunlang, mijoz qabul qilgach ${formatPrice(row.netAmount)} balansingizga tushadi.`,
      orderHref(order.id),
    );
    await notify(order.clientId, "order_paid", "To'lov qabul qilindi", `«${order.title}» — ${formatPrice(row.amount)} eskrouda saqlanmoqda. Ish yakunlangach uni qabul qilasiz.`, orderHref(order.id));
  }
  await audit(extra.actorId ?? null, "payment_paid", { targetType: "payment", targetId: row.id, meta: { orderId: row.orderId, provider: row.provider, amount: row.amount } }, extra.req);
  return row;
}

/**
 * Mijoz ishni qabul qildi → eskroudagi pul mutaxassis balansiga (released).
 * Buyurtma: completedAt, paymentState 'released' (to'lov bo'lmasa faqat completedAt).
 */
export async function releaseOrder(orderId: string, actorId: string | null, req?: Request): Promise<{ released: Payment[] }> {
  const now = new Date();
  const paid = await db.query.payments.findMany({ where: and(eq(payments.orderId, orderId), eq(payments.state, "paid")) });
  const released: Payment[] = [];
  for (const p of paid) {
    // Faqat hali "paid" turgan yozuv o'tkaziladi — parallel chaqiruvda ikkinchi marta audit/bildirishnoma ketmaydi
    const [row] = await db
      .update(payments)
      .set({ state: "released", releasedAt: now, updatedAt: now })
      .where(and(eq(payments.id, p.id), eq(payments.state, "paid")))
      .returning();
    if (!row) continue;
    released.push(row);
    await audit(actorId, "payment_released", { targetType: "payment", targetId: row.id, meta: { orderId, netAmount: row.netAmount } }, req);
  }
  await db
    .update(orders)
    .set({ completedAt: now, updatedAt: now, ...(released.length ? { paymentState: "released" as const } : {}) })
    .where(eq(orders.id, orderId));

  const order = await loadOrderWithParties(orderId);
  if (order) {
    const net = released.reduce((s, p) => s + p.netAmount, 0);
    await notify(
      order.specialist.userId,
      "order_released",
      released.length ? `Pul balansga tushdi: ${formatPrice(net)}` : "Mijoz ishni qabul qildi",
      released.length ? `«${order.title}» — mijoz ishni qabul qildi. Pulni «To'lovlar» bo'limidan chiqarib olishingiz mumkin.` : `«${order.title}» yakunlandi.`,
      released.length ? "/kabinet/tolovlar" : orderHref(order.id),
    );
  }
  return { released };
}

/** Admin: eskroudagi pulni mijozga qaytarish (released bo'lmagan to'lov) */
export async function refundPayment(paymentId: string, actorId: string | null, reason?: number | null, req?: Request): Promise<Payment> {
  const current = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
  if (!current) throw new ApiError(404, "To'lov topilmadi");
  if (current.state === "refunded") return current;
  if (current.state !== "paid") throw new ApiError(400, "Faqat eskroudagi (to'langan) to'lovni qaytarish mumkin");
  const now = new Date();
  const [row] = await db
    .update(payments)
    .set({ state: "refunded", cancelTime: now.getTime(), cancelReason: reason ?? 5, providerState: -2, updatedAt: now })
    .where(eq(payments.id, paymentId))
    .returning();
  await db.update(orders).set({ paymentState: "refunded", updatedAt: now }).where(eq(orders.id, row.orderId));
  const order = await loadOrderWithParties(row.orderId);
  if (order) {
    await notify(order.clientId, "payment_refunded", `Pul qaytarildi: ${formatPrice(row.amount)}`, `«${order.title}» bo'yicha to'lovingiz qaytarildi.`, orderHref(order.id));
    await notify(order.specialist.userId, "payment_refunded", "To'lov mijozga qaytarildi", `«${order.title}» bo'yicha eskroudagi pul mijozga qaytarildi.`, orderHref(order.id));
  }
  await audit(actorId, "payment_refunded", { targetType: "payment", targetId: row.id, meta: { orderId: row.orderId, amount: row.amount, reason } }, req);
  return row;
}

/** Ochiq (created/pending) to'lovni bekor qilish — pul harakati bo'lmagan */
export async function cancelPayment(paymentId: string, reason?: number | null): Promise<Payment> {
  const current = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
  if (!current) throw new ApiError(404, "To'lov topilmadi");
  if (current.state === "cancelled") return current;
  if (!(ACTIVE_PAYMENT_STATES as readonly string[]).includes(current.state)) throw new ApiError(400, "Bu to'lovni bekor qilib bo'lmaydi");
  const now = new Date();
  const [row] = await db
    .update(payments)
    .set({ state: "cancelled", cancelTime: now.getTime(), cancelReason: reason ?? null, providerState: -1, updatedAt: now })
    .where(eq(payments.id, paymentId))
    .returning();
  return row;
}

/**
 * Buyurtma bekor qilinganda: ochiq urinishlarni yopish; to'langan bo'lsa adminga qaytarish uchun xabar.
 * Provayder (Payme/Click) tomonida jarayondagi tranzaksiya ichkaridan bekor qilinmaydi — uni faqat
 * provayderning CancelTransaction/Complete(error) chaqiruvi yoki muddat o'tishi yopadi (protokol talabi).
 * Shuning uchun status route'i bunday to'lov bo'lsa bekor qilishga 409 qaytaradi.
 */
export async function onOrderCancelled(order: OrderWithParties, byUserId: string, reason?: string | null): Promise<void> {
  const now = new Date();
  const open = await db.query.payments.findMany({ where: and(eq(payments.orderId, order.id), inArray(payments.state, [...ACTIVE_PAYMENT_STATES])) });
  const closable = open
    .filter((p) => p.state === "created" || p.provider === "manual" || now.getTime() - (p.providerCreateTime ?? p.createdAt.getTime()) > PROVIDER_PENDING_TTL_MS)
    .map((p) => p.id);
  if (closable.length) {
    await db
      .update(payments)
      .set({ state: "cancelled", providerState: -1, cancelTime: now.getTime(), cancelReason: 4, updatedAt: now })
      .where(inArray(payments.id, closable));
  }
  if (order.paymentState === "awaiting") {
    // Pul harakati bo'lmagan — narx kelishuvi bekor
    await db.update(orders).set({ paymentState: "none", updatedAt: now }).where(eq(orders.id, order.id));
  }
  if (order.paymentState === "paid") {
    await notifyAdmins(
      "refund_needed",
      "To'langan buyurtma bekor qilindi — qaytarish kerak",
      `«${order.title}» (${formatPrice(order.amount ?? 0)}) ${byUserId === order.clientId ? "mijoz" : "mutaxassis"} tomonidan bekor qilindi.${reason ? ` Sabab: ${reason}` : ""}`,
      "/admin#tolovlar",
    );
  }
}
