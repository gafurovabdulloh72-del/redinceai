import "server-only";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { orderEvents, orders, payments, specialists, type Order, type OrderEventType, type Payment } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import type { PaymentProvider } from "@/lib/constants";
import { notify, notifyAdmins } from "@/lib/notifications";
import { notifyAdminsManualPending } from "@/lib/manual-approval";
import { audit } from "@/lib/security/audit";
import { formatDate, formatPrice, uid } from "@/lib/utils";
import { isProviderConfigured, paymentsEnv } from "./config";
import { getSettings, isTopRated, splitAmount } from "./settings";

/* ------------------------------------------------------------------ */
/* Yordamchilar                                                        */
/* ------------------------------------------------------------------ */
export const ACTIVE_PAYMENT_STATES = ["created", "pending"] as const;
export const orderHref = (orderId: string) => `/kabinet/buyurtmalar?id=${orderId}`;
export const PROVIDER_NAME: Record<PaymentProvider, string> = { payme: "Payme", click: "Click", manual: "O'tkazma" };

/** Mijoz shuncha kun ichida ishni qabul qilmasa eskrou avtomatik mutaxassisga o'tadi (E57/F18) */
export const AUTO_RELEASE_DAYS = 7;
export const autoReleaseDate = (from = Date.now()) => new Date(from + AUTO_RELEASE_DAYS * 24 * 60 * 60 * 1000);

/**
 * Buyurtma tarixi (order_events): holat/narx/to'lov/nizo/izoh. Hech qachon xato tashlamaydi —
 * asosiy oqimni jurnal xatosi buzmasin. actorId null = tizim (cron, provayder webhook'i).
 */
export async function recordOrderEvent(
  orderId: string,
  actorId: string | null | undefined,
  type: OrderEventType,
  opts: { fromStatus?: string | null; toStatus?: string | null; note?: string | null } = {},
): Promise<void> {
  try {
    await db.insert(orderEvents).values({
      id: uid(),
      orderId,
      actorId: actorId ?? null,
      type,
      fromStatus: opts.fromStatus ?? null,
      toStatus: opts.toStatus ?? null,
      note: opts.note ? opts.note.slice(0, 600) : null,
    });
  } catch (e) {
    console.error("[orderEvent]", type, e);
  }
}

/** db.transaction ichidagi tx turi — pul harakatlari bitta tranzaksiyada bajarilishi uchun */
type DbOrTx = typeof db | Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

/** Pul harakati (release/refund) nizoni ma'nosiz qiladi — ochiq bo'lsa 'resolved' (resolveDispute o'zi ham shuni yozadi) */
async function closeOpenDispute(orderId: string, now: Date, dbc: DbOrTx = db): Promise<void> {
  await dbc.update(orders).set({ disputeState: "resolved", updatedAt: now }).where(and(eq(orders.id, orderId), eq(orders.disputeState, "open")));
}

/** Buyurtma + tomonlar (to'lov oqimida bildirishnoma yuborish uchun) */
export async function loadOrderWithParties(orderId: string) {
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: {
      client: { columns: { id: true, name: true } },
      specialist: { columns: { id: true, userId: true, slug: true, title: true, completedCount: true, topRated: true }, with: { user: { columns: { name: true, avatarUrl: true } } } },
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

/** Qo'lda o'tkazma bo'yicha admin tasdig'ini kutayotgan (pending) to'lov — boshqa usulda ikkinchi to'lov ochilmasin */
export const MANUAL_PENDING_MESSAGE = "Bu buyurtma bo'yicha qo'lda o'tkazma kutilmoqda — avval admin tasdig'ini kuting yoki uni bekor qiling";
export async function findPendingManualPayment(orderId: string): Promise<Payment | null> {
  const row = await db.query.payments.findFirst({
    where: and(eq(payments.orderId, orderId), eq(payments.state, "pending"), eq(payments.provider, "manual")),
  });
  return row ?? null;
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
  if (!(await isProviderConfigured(provider))) throw new ApiError(400, "Bu to'lov usuli hozircha ulanmagan");
  if (order.status === "cancelled") throw new ApiError(400, "Bekor qilingan buyurtma uchun to'lov qilib bo'lmaydi");
  if (order.paymentState === "paid" || order.paymentState === "released") throw new ApiError(400, "Bu buyurtma allaqachon to'langan");
  if (!isPayable(order) || !order.amount) throw new ApiError(400, "Avval mutaxassis narx belgilashi kerak");

  // Provayder tomonida jarayondagi tranzaksiya bo'lsa — ikkinchi to'lov ochilmaydi
  const inFlight = await findInFlightProviderPayment(order.id);
  if (inFlight) {
    if (inFlight.provider === provider) return { payment: inFlight, redirectUrl: buildRedirectUrl(inFlight, opts.origin) };
    throw new ApiError(409, "Bu buyurtma uchun boshqa usul orqali to'lov jarayonda. Avval uni yakunlang yoki bekor bo'lishini kuting");
  }
  // Admin tasdig'ini kutayotgan qo'lda o'tkazma ham jarayondagi to'lov: boshqa usulda ikkinchi marta to'lab qo'ymasin
  // (manual uchun quyida mavjud pending yozuvning o'zi qayta ishlatiladi)
  if (provider !== "manual") {
    const manualPending = await findPendingManualPayment(order.id);
    if (manualPending) throw new ApiError(409, MANUAL_PENDING_MESSAGE);
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
    await recordOrderEvent(order.id, opts.actorId, "payment", { note: `To'lov boshlandi — ${PROVIDER_NAME[provider]}, ${formatPrice(order.amount)}` });
  }

  return { payment, redirectUrl: buildRedirectUrl(payment, opts.origin) };
}

/** Qo'lda o'tkazma: mijoz "To'ladim" bosdi → pending, admin tasdiqlaydi */
export async function markManualSent(payment: Payment, actorId: string, req?: Request, receiptUrl?: string | null): Promise<Payment> {
  if (payment.provider !== "manual") throw new ApiError(400, "Bu to'lov provayder orqali tasdiqlanadi");
  if (payment.state === "pending") return payment;
  if (payment.state !== "created") throw new ApiError(400, "To'lov holati o'zgartirib bo'lmaydi");
  const [row] = await db
    .update(payments)
    .set({
      state: "pending",
      providerTxnId: payment.providerTxnId ?? `manual-${payment.id.slice(0, 8)}`,
      meta: { ...payment.meta, ...(receiptUrl ? { receiptUrl } : {}) },
      updatedAt: new Date(),
    })
    .where(eq(payments.id, payment.id))
    .returning();
  const order = await loadOrderWithParties(payment.orderId);
  await notifyAdminsManualPending({
    kind: "pay",
    type: "payment_pending",
    id: payment.id,
    title: "Qo'lda o'tkazma tasdiqlashni kutmoqda",
    body: order ? `${order.client.name} — «${order.title}» uchun ${formatPrice(payment.amount)} o'tkazganini bildirdi.` : `${formatPrice(payment.amount)} o'tkazma tasdiqlash kutilmoqda.`,
    href: "/admin#tolovlar",
    receiptUrl,
  });
  await audit(actorId, "payment_created", { targetType: "payment", targetId: payment.id, meta: { manualSent: true, receipt: Boolean(receiptUrl) } }, req);
  await recordOrderEvent(payment.orderId, actorId, "payment", { note: `Mijoz o'tkazma yuborganini bildirdi (${formatPrice(payment.amount)}) — admin tasdig'i kutilmoqda` });
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
  // To'lov va buyurtma yangilanishi BITTA tranzaksiyada (billing.ts markInvoicePaid naqshi) — yarim holat qolmaydi.
  // Holatga bog'liq yangilash: parallel PerformTransaction/Complete chaqiruvlarida faqat bittasi "paid" yo'lidan o'tadi
  const result = await db.transaction(async (tx) => {
    const [row] = await tx
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
    if (!row) return null;

    // Ish allaqachon topshirilgan (done) bo'lsa — avtomatik qabul muddati shu yerdan boshlanadi
    const orderRow = await tx.query.orders.findFirst({ where: eq(orders.id, row.orderId), columns: { status: true, completedAt: true } });
    const autoRelease = orderRow?.status === "done" ? autoReleaseDate(now.getTime()) : null;
    await tx
      .update(orders)
      .set({ paymentState: "paid", commissionPct: row.commissionPct, updatedAt: now, ...(autoRelease ? { autoReleaseAt: autoRelease } : {}) })
      .where(eq(orders.id, row.orderId));

    // Boshqa provayder orqali boshlangan, hali to'lanmagan urinishlar (Payme/Click uchun holat -1 deb qaytariladi)
    const cancelled = await tx
      .update(payments)
      .set({ state: "cancelled", providerState: -1, cancelTime: now.getTime(), cancelReason: 4, updatedAt: now })
      .where(and(eq(payments.orderId, row.orderId), ne(payments.id, row.id), inArray(payments.state, [...ACTIVE_PAYMENT_STATES])))
      .returning();
    return { row, autoRelease, cancelled };
  });
  if (!result) {
    const fresh = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
    if (fresh && (fresh.state === "paid" || fresh.state === "released")) return fresh;
    throw new ApiError(409, "To'lov holati o'zgargan — qayta tasdiqlab bo'lmaydi");
  }
  const { row, autoRelease, cancelled } = result;

  // Bekor qilinganlar orasida qo'lda o'tkazma bo'lsa — jim yo'qolmasin: audit + adminga xabar
  // (mijoz "To'ladim" degan bo'lishi mumkin — admin haqiqiy o'tkazmani tekshirsin)
  const cancelledManual = cancelled.find((p) => p.provider === "manual");
  if (cancelledManual) {
    await audit(extra.actorId ?? null, "payment_cancelled", { targetType: "payment", targetId: cancelledManual.id, meta: { orderId: cancelledManual.orderId, provider: "manual", amount: cancelledManual.amount, autoCancelledBy: row.id } }, extra.req);
    await notifyAdmins(
      "payment_pending",
      "Qo'lda o'tkazma avtomatik bekor qilindi",
      `Buyurtma boshqa usul (${PROVIDER_NAME[row.provider]}) orqali to'landi, shu sababli ${formatPrice(cancelledManual.amount)} lik qo'lda o'tkazma yozuvi bekor qilindi. Mijoz o'tkazmani haqiqatda yuborgan bo'lsa, qaytarishni ko'rib chiqing.`,
      "/admin#tolovlar",
    );
  }

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
  await recordOrderEvent(row.orderId, extra.actorId ?? (row.provider === "manual" ? null : row.clientId), "payment", {
    note: `${PROVIDER_NAME[row.provider]} orqali to'landi — ${formatPrice(row.amount)} eskrouda${autoRelease ? `. Avtomatik qabul: ${formatDate(autoRelease)}` : ""}`,
  });
  return row;
}

/**
 * O'z-o'zini tuzatish (webhook idempotentligi): to'lov allaqachon 'paid'/'released', lekin buyurtma
 * yangilanishi o'tib ketgan bo'lsa (masalan, avvalgi Perform/Complete yarmida uzilgan) — markPaid'dagi
 * buyurtma yangilanishini qayta bajaradi. Hech qachon xato tashlamaydi (webhook javobini buzmasin).
 */
export async function ensureOrderPaidState(payment: Payment): Promise<void> {
  try {
    if (payment.state !== "paid" && payment.state !== "released") return;
    const order = await db.query.orders.findFirst({ where: eq(orders.id, payment.orderId), columns: { paymentState: true, status: true } });
    if (!order || order.paymentState === "paid" || order.paymentState === "released") return;
    const now = new Date();
    const autoRelease = payment.state === "paid" && order.status === "done" ? autoReleaseDate(now.getTime()) : null;
    await db
      .update(orders)
      .set({
        paymentState: payment.state === "released" ? "released" : "paid",
        commissionPct: payment.commissionPct,
        updatedAt: now,
        ...(autoRelease ? { autoReleaseAt: autoRelease } : {}),
      })
      .where(and(eq(orders.id, payment.orderId), inArray(orders.paymentState, ["none", "awaiting"])));
  } catch (e) {
    console.error("[ensureOrderPaidState]", payment.id, e);
  }
}

export interface ReleaseOptions {
  /** Cron: mijoz muddat ichida javob bermadi (actorId null) */
  auto?: boolean;
  /** Admin nizo qarori bilan o'tkazdi */
  viaDispute?: boolean;
}

/**
 * Mijoz ishni qabul qildi → eskroudagi pul mutaxassis balansiga (released).
 * Buyurtma: completedAt, paymentState 'released' (to'lov bo'lmasa faqat completedAt), autoReleaseAt tozalanadi.
 * Birinchi yakunlashda mutaxassisning completedCount +1, topRated qayta hisoblanadi (F21/F69).
 */
export async function releaseOrder(orderId: string, actorId: string | null, req?: Request, opts: ReleaseOptions = {}): Promise<{ released: Payment[] }> {
  const now = new Date();
  // To'lov(lar) va buyurtma yangilanishi BITTA tranzaksiyada — release yarim holatda qolmaydi
  const result = await db.transaction(async (tx) => {
    const before = await tx.query.orders.findFirst({ where: eq(orders.id, orderId), columns: { completedAt: true, specialistId: true, status: true, disputeState: true } });
    // Cron so'rovi bilan release orasida nizo ochilgan bo'lishi mumkin — avtomatik release nizo ochiq bo'lsa to'xtaydi
    if (opts.auto && before?.disputeState === "open") return { released: [] as Payment[], before, finishStatus: false, skipped: true };
    const paid = await tx.query.payments.findMany({ where: and(eq(payments.orderId, orderId), eq(payments.state, "paid")) });
    const released: Payment[] = [];
    for (const p of paid) {
      // Faqat hali "paid" turgan yozuv o'tkaziladi — parallel chaqiruvda ikkinchi marta audit/bildirishnoma ketmaydi
      const [row] = await tx
        .update(payments)
        .set({ state: "released", releasedAt: now, updatedAt: now })
        .where(and(eq(payments.id, p.id), eq(payments.state, "paid")))
        .returning();
      if (!row) continue;
      released.push(row);
    }
    // Admin (to'lovlar jadvali yoki nizo qarori) pulni jarayondagi buyurtmada o'tkazsa — ish qabul qilingan hisoblanadi: status 'done'
    const finishStatus = released.length > 0 && (before?.status === "accepted" || before?.status === "in_progress");
    await tx
      .update(orders)
      .set({
        completedAt: before?.completedAt ?? now,
        autoReleaseAt: null,
        updatedAt: now,
        ...(released.length ? { paymentState: "released" as const } : {}),
        ...(finishStatus ? { status: "done" as const } : {}),
      })
      .where(eq(orders.id, orderId));
    // Admin pulni to'lovlar jadvalidan o'tkazgan bo'lsa ochiq nizo ham yopiladi (mijoz/cron yo'li ochiq nizoda bu yerga kelmaydi)
    if (released.length) await closeOpenDispute(orderId, now, tx);
    return { released, before, finishStatus, skipped: false };
  });
  const { released, before, finishStatus } = result;
  if (result.skipped) return { released: [] };
  for (const row of released) {
    await audit(actorId, "payment_released", { targetType: "payment", targetId: row.id, meta: { orderId, netAmount: row.netAmount } }, req);
  }
  if (finishStatus && before) await recordOrderEvent(orderId, actorId, "status", { fromStatus: before.status, toStatus: "done", note: "Pul admin qarori bilan o'tkazildi — buyurtma yakunlandi" });

  // Birinchi yakunlash: bajarilgan buyurtmalar soni + "Top mutaxassis" nishoni
  if (before && !before.completedAt) {
    try {
      const [sp] = await db
        .update(specialists)
        .set({ completedCount: sql`${specialists.completedCount} + 1`, updatedAt: now })
        .where(eq(specialists.id, before.specialistId))
        .returning({ id: specialists.id, completedCount: specialists.completedCount, rating: specialists.rating, reviewCount: specialists.reviewCount, topRated: specialists.topRated });
      if (sp) {
        const top = isTopRated(sp);
        if (top !== sp.topRated) await db.update(specialists).set({ topRated: top }).where(eq(specialists.id, sp.id));
      }
    } catch (e) {
      console.error("[releaseOrder] completedCount", e);
    }
  }

  const net = released.reduce((s, p) => s + p.netAmount, 0);
  const how = opts.auto ? `Avtomatik qabul (${AUTO_RELEASE_DAYS} kun ichida javob bo'lmadi)` : opts.viaDispute ? "Admin nizo qarori" : "Mijoz ishni qabul qildi";
  await recordOrderEvent(orderId, actorId, "payment", { note: released.length ? `${how} — ${formatPrice(net)} mutaxassis balansiga o'tdi` : `${how} — buyurtma yakunlandi` });

  const order = await loadOrderWithParties(orderId);
  if (order) {
    await notify(
      order.specialist.userId,
      "order_released",
      released.length ? `Pul balansga tushdi: ${formatPrice(net)}` : "Mijoz ishni qabul qildi",
      released.length ? `«${order.title}» — ${opts.auto ? "mijoz muddat ichida javob bermadi, ish avtomatik qabul qilindi" : opts.viaDispute ? "admin nizoni sizning foydangizga hal qildi" : "mijoz ishni qabul qildi"}. Pulni «To'lovlar» bo'limidan chiqarib olishingiz mumkin.` : `«${order.title}» yakunlandi.`,
      released.length ? "/kabinet/tolovlar" : orderHref(order.id),
    );
    if (opts.auto && released.length) {
      await notify(
        order.clientId,
        "order_released",
        "Ish avtomatik qabul qilindi",
        `«${order.title}» — ${AUTO_RELEASE_DAYS} kun ichida javob bo'lmagani uchun eskroudagi ${formatPrice(order.amount ?? 0)} mutaxassisga o'tkazildi.`,
        orderHref(order.id),
      );
    }
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
  // Holatga bog'liq (faqat 'paid' → 'refunded') va buyurtma bilan BITTA tranzaksiyada:
  // parallel release qilingan (mutaxassisga o'tgan) to'lov hech qachon qaytarilmaydi
  const row = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(payments)
      .set({ state: "refunded", cancelTime: now.getTime(), cancelReason: reason ?? 5, providerState: -2, updatedAt: now })
      .where(and(eq(payments.id, paymentId), eq(payments.state, "paid")))
      .returning();
    if (!updated) return null;
    await tx.update(orders).set({ paymentState: "refunded", autoReleaseAt: null, updatedAt: now }).where(eq(orders.id, updated.orderId));
    // Pul qaytdi — ochiq nizo ortiqcha (admin to'lovlar jadvalidan yoki Payme CancelTransaction orqali qaytargan bo'lsa)
    await closeOpenDispute(updated.orderId, now, tx);
    return updated;
  });
  if (!row) {
    // Parallel o'zgargan — ustidan yozmaymiz, joriy holatni qaytaramiz
    const fresh = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
    if (fresh?.state === "refunded") return fresh;
    throw new ApiError(409, "To'lov holati o'zgargan — qaytarib bo'lmaydi. Sahifani yangilang");
  }
  await recordOrderEvent(row.orderId, actorId, "payment", { note: `${formatPrice(row.amount)} mijozga qaytarildi${actorId ? "" : " (provayder orqali)"}` });
  const order = await loadOrderWithParties(row.orderId);
  if (order) {
    await notify(order.clientId, "payment_refunded", `Pul qaytarildi: ${formatPrice(row.amount)}`, `«${order.title}» bo'yicha to'lovingiz qaytarildi.`, orderHref(order.id));
    await notify(order.specialist.userId, "payment_refunded", "To'lov mijozga qaytarildi", `«${order.title}» bo'yicha eskroudagi pul mijozga qaytarildi.`, orderHref(order.id));
  }
  await audit(actorId, "payment_refunded", { targetType: "payment", targetId: row.id, meta: { orderId: row.orderId, amount: row.amount, reason } }, req);
  return row;
}

/** Ochiq (created/pending) to'lovni bekor qilish — pul harakati bo'lmagan */
export async function cancelPayment(paymentId: string, reason?: number | null, actorId?: string | null): Promise<Payment> {
  const current = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
  if (!current) throw new ApiError(404, "To'lov topilmadi");
  if (current.state === "cancelled") return current;
  if (!(ACTIVE_PAYMENT_STATES as readonly string[]).includes(current.state)) throw new ApiError(400, "Bu to'lovni bekor qilib bo'lmaydi");
  const now = new Date();
  // Holatga bog'liq: parallel to'lanib bo'lgan (paid) yozuv hech qachon 'cancelled'ga qaytarilmaydi
  const [row] = await db
    .update(payments)
    .set({ state: "cancelled", cancelTime: now.getTime(), cancelReason: reason ?? null, providerState: -1, updatedAt: now })
    .where(and(eq(payments.id, paymentId), inArray(payments.state, [...ACTIVE_PAYMENT_STATES])))
    .returning();
  if (!row) {
    const fresh = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
    if (fresh?.state === "cancelled") return fresh;
    throw new ApiError(409, `Bu to'lovni bekor qilib bo'lmaydi — holati o'zgargan${fresh ? ` (${fresh.state})` : ""}`);
  }
  await recordOrderEvent(row.orderId, actorId ?? null, "payment", { note: `To'lov urinishi bekor qilindi (${PROVIDER_NAME[row.provider]}, ${formatPrice(row.amount)})` });
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
