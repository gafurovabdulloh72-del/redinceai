import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { specialists, subscriptionInvoices, type SubscriptionInvoice } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { SUBSCRIPTION_INVOICE_PREFIX, SUBSCRIPTION_PLANS, type PaymentProvider } from "@/lib/constants";
import { notify, notifyAdmins } from "@/lib/notifications";
import { notifyAdminsManualPending } from "@/lib/manual-approval";
import { getManualCard } from "@/lib/payments/settings";
import { isProviderConfigured, paymentsEnv } from "@/lib/payments/config";
import { getSettings, type PlatformSettings } from "@/lib/payments/settings";
import { audit } from "@/lib/security/audit";
import { afterPaidInvoice, fulfillPurchase, isPurchase, purchaseHref, purchaseMeta, releaseHolds, revokePurchase } from "@/lib/mentorship/purchases";
import { afterContactPaidInvoice, contactHref, contactMeta, fulfillContactUnlock, isContactUnlock, revokeContactUnlock } from "@/lib/contacts/unlock";
import { formatDate, formatPrice } from "@/lib/utils";
import { addMonths, planDiscountPct, planPrice, subscriptionPeriod, subscriptionState } from "./access";
import { invoiceNumber, type InvoiceView, type PlanView } from "./labels";

/**
 * Mutaxassis obunasi — hisoblar (subscription_invoices) va pul oqimi.
 *
 *  createInvoice   → 'created' (Payme/Click havolasi yoki o'tkazma rekvizitlari)
 *  Payme/Click     → 'pending' (provayder tranzaksiyasi bog'landi) → PerformTransaction/Complete → markInvoicePaid
 *  O'tkazma        → markInvoiceSent ('pending', «To'ladim») → admin tasdiqlaydi → markInvoicePaid
 *  markInvoicePaid → 'paid': specialists.subscriptionUntil = max(now, joriy until) + N kalendar oy (access.subscriptionPeriod)
 *  refundInvoice   → 'refunded' (admin yoki Payme CancelTransaction): until shu davr uzunligiga qisqaradi, hech qachon now'dan pastga emas
 *  cancelInvoice   → 'cancelled' (pul harakati bo'lmagan)
 *
 * Payme account.order_id / Click merchant_trans_id = hisob id ("sub_…") — eskrou buyurtmalaridan prefiks bilan ajraladi.
 * Holat qoidasi (trial/active/grace/expired) faqat access.ts'da.
 */

export const INVOICE_OPEN_STATES = ["created", "pending"] as const;
/** Payme/Click tomonida yaratilgan, lekin bajarilmagan tranzaksiya shu muddatdan keyin eskiradi (Payme 12 soat qoidasi) */
export const INVOICE_PROVIDER_TTL_MS = 12 * 60 * 60 * 1000;
export const SUBSCRIPTION_HREF = "/kabinet/obuna";
export const invoiceHref = (id: string) => `${SUBSCRIPTION_HREF}?invoice=${encodeURIComponent(id)}`;
export const receiptHref = (id: string) => `${SUBSCRIPTION_HREF}/chek/${encodeURIComponent(id)}`;

const DAY = 86_400_000;

export function isInvoiceId(id: string | null | undefined): id is string {
  return typeof id === "string" && id.startsWith(SUBSCRIPTION_INVOICE_PREFIX);
}

function newInvoiceId(): string {
  return `${SUBSCRIPTION_INVOICE_PREFIX}${randomUUID()}`;
}

export function isPlanMonths(m: number): boolean {
  return SUBSCRIPTION_PLANS.some((p) => p.months === m);
}

/** Rejalar ro'yxati (joriy narx bilan) */
export function plansFor(s: Pick<PlatformSettings, "subscriptionPrice">): PlanView[] {
  return SUBSCRIPTION_PLANS.map((p) => {
    const price = planPrice(p.months, s);
    const full = s.subscriptionPrice * p.months;
    return { months: p.months, discountPct: p.discountPct, price, monthly: Math.round(price / p.months / 100) * 100, savings: Math.max(0, full - price) };
  });
}

export function toInvoiceView(i: SubscriptionInvoice): InvoiceView {
  return {
    id: i.id,
    number: invoiceNumber(i.id),
    months: i.months,
    amount: i.amount,
    provider: i.provider,
    state: i.state,
    periodStart: i.periodStart?.getTime() ?? null,
    periodEnd: i.periodEnd?.getTime() ?? null,
    paidAt: i.paidAt?.getTime() ?? null,
    createdAt: i.createdAt.getTime(),
    attempted: i.providerTxnId != null,
  };
}

/** Payme/Click 'pending' tranzaksiyasi hali jarayonda (12 soatdan eskirmagan) */
export function isProviderInFlight(i: Pick<SubscriptionInvoice, "provider" | "state" | "providerCreateTime" | "createdAt">, now = Date.now()): boolean {
  return i.provider !== "manual" && i.state === "pending" && now - (i.providerCreateTime ?? i.createdAt.getTime()) <= INVOICE_PROVIDER_TTL_MS;
}

/* ------------------------------------------------------------------ */
/* O'qish                                                              */
/* ------------------------------------------------------------------ */
export async function loadInvoice(id: string): Promise<SubscriptionInvoice | null> {
  if (!isInvoiceId(id)) return null;
  return (await db.query.subscriptionInvoices.findFirst({ where: eq(subscriptionInvoices.id, id) })) ?? null;
}

export async function listInvoicesForSpecialist(specialistId: string, limit = 50): Promise<SubscriptionInvoice[]> {
  return db.query.subscriptionInvoices.findMany({
    where: eq(subscriptionInvoices.specialistId, specialistId),
    orderBy: [desc(subscriptionInvoices.createdAt)],
    limit,
  });
}

/** Mutaxassis (yoki admin) hisobni ko'ra oladimi */
export function canViewInvoice(i: Pick<SubscriptionInvoice, "userId" | "specialistId">, viewer: { id: string; role: string; specialistId?: string | null }): boolean {
  if (viewer.role === "admin") return true;
  return i.userId === viewer.id || (Boolean(viewer.specialistId) && i.specialistId === viewer.specialistId);
}

/* ------------------------------------------------------------------ */
/* Yo'naltirish havolasi                                               */
/* ------------------------------------------------------------------ */
/**
 * Provayder checkout havolasi (eskrou buildRedirectUrl bilan bir xil format), qaytish — /kabinet/obuna?invoice=<id>.
 *  Payme: base64("m=…;ac.order_id=<sub_…>;a=<tiyin>;c=<return>;l=uz")
 *  Click: my.click.uz/services/pay?…&transaction_param=<sub_…>  (Click merchant_trans_id sifatida qaytaradi)
 *  O'tkazma: null — rekvizitlar ko'rsatiladi
 */
export function buildInvoiceRedirectUrl(invoice: Pick<SubscriptionInvoice, "id" | "amount" | "provider"> & { meta?: SubscriptionInvoice["meta"] }, origin: string): string | null {
  const env = paymentsEnv();
  const back = `${origin}${invoice.meta && isContactUnlock({ meta: invoice.meta }) ? contactHref(invoice.id) : invoice.meta && isPurchase({ meta: invoice.meta }) ? purchaseHref(invoice.id) : invoiceHref(invoice.id)}`;
  if (invoice.provider === "payme") {
    if (!env.payme.merchantId) return null;
    const params = `m=${env.payme.merchantId};ac.order_id=${invoice.id};a=${invoice.amount * 100};c=${back};l=uz`;
    return env.payme.checkoutUrl + Buffer.from(params, "utf8").toString("base64");
  }
  if (invoice.provider === "click") {
    if (!env.click.serviceId || !env.click.merchantId) return null;
    const q = new URLSearchParams({
      service_id: env.click.serviceId,
      merchant_id: env.click.merchantId,
      amount: invoice.amount.toFixed(2),
      transaction_param: invoice.id,
      return_url: back,
    });
    if (env.click.merchantUserId) q.set("merchant_user_id", env.click.merchantUserId);
    return `https://my.click.uz/services/pay?${q.toString()}`;
  }
  return null;
}

/** O'tkazma rekvizitlari (eskrou checkout'dagi karta bilan bir xil) */
export async function manualRequisites(): Promise<{ card: string; name: string } | null> {
  const m = await getManualCard();
  return m.card ? { card: m.card, name: m.name } : null;
}

/* ------------------------------------------------------------------ */
/* Hisob yaratish                                                      */
/* ------------------------------------------------------------------ */
export interface InvoiceSubject {
  id: string;
  userId: string;
}

/**
 * Obuna hisobi: summa = planPrice(months). Shu oylar + provayder bo'yicha ochiq hisob bo'lsa — qayta ishlatiladi
 * ('created'; o'tkazmada «To'ladim» bosilgan 'pending'; Payme/Click'da jarayondagi 'pending'). Yangi hisob ochilganda
 * mutaxassisning boshqa hali provayderga yuborilmagan ('created') hisoblari bekor qilinadi — eski tabdagi havola
 * orqali ikki marta to'lab yuborilmasin.
 */
export async function createInvoice(
  specialist: InvoiceSubject,
  months: number,
  provider: PaymentProvider,
  opts: { actorId: string; req?: Request } = { actorId: specialist.userId },
): Promise<{ invoice: SubscriptionInvoice; reused: boolean }> {
  if (!isPlanMonths(months)) throw new ApiError(422, "Bunday obuna rejasi yo'q", { months: "1, 3, 6 yoki 12 oy tanlang" });
  if (!isProviderConfigured(provider)) throw new ApiError(400, "Bu to'lov usuli hozircha ulanmagan");
  const settings = await getSettings();
  const amount = planPrice(months, settings);
  if (amount <= 0) throw new ApiError(400, "Obuna narxi hali belgilanmagan — administrator bilan bog'laning");

  const now = new Date();
  const open = await db.query.subscriptionInvoices.findMany({
    where: and(eq(subscriptionInvoices.specialistId, specialist.id), eq(subscriptionInvoices.months, months), eq(subscriptionInvoices.provider, provider), inArray(subscriptionInvoices.state, [...INVOICE_OPEN_STATES])),
    orderBy: [desc(subscriptionInvoices.createdAt)],
  });
  for (const inv of open) {
    if (inv.state === "pending") {
      // O'tkazma: «To'ladim» bosilgan — admin tasdig'ini kutadi, ikkinchi hisob ochilmaydi. Payme/Click: jarayondagi tranzaksiya.
      if (inv.provider === "manual" || isProviderInFlight(inv, now.getTime())) return { invoice: inv, reused: true };
      continue;
    }
    // 'created': narx o'zgargan bo'lsa yangilanadi (provayderga hali yuborilmagan)
    if (inv.amount !== amount) {
      const [row] = await db
        .update(subscriptionInvoices)
        .set({ amount, meta: { ...inv.meta, unitPrice: settings.subscriptionPrice, discountPct: planDiscountPct(months) }, updatedAt: now })
        .where(and(eq(subscriptionInvoices.id, inv.id), eq(subscriptionInvoices.state, "created")))
        .returning();
      if (row) return { invoice: row, reused: true };
      continue;
    }
    return { invoice: inv, reused: true };
  }

  // Boshqa reja/usul bo'yicha hali yuborilmagan hisoblar — bekor (pul harakati yo'q)
  await db
    .update(subscriptionInvoices)
    .set({ state: "cancelled", providerState: -1, cancelTime: now.getTime(), cancelReason: 4, updatedAt: now })
    .where(and(eq(subscriptionInvoices.specialistId, specialist.id), eq(subscriptionInvoices.state, "created")));

  const [invoice] = await db
    .insert(subscriptionInvoices)
    .values({
      id: newInvoiceId(),
      specialistId: specialist.id,
      userId: specialist.userId,
      months,
      amount,
      provider,
      state: "created",
      meta: { unitPrice: settings.subscriptionPrice, discountPct: planDiscountPct(months) },
    })
    .returning();
  await audit(opts.actorId, "subscription_created", { targetType: "subscription_invoice", targetId: invoice.id, meta: { specialistId: specialist.id, months, amount, provider } }, opts.req);
  return { invoice, reused: false };
}

/* ------------------------------------------------------------------ */
/* Holat o'zgarishlari                                                 */
/* ------------------------------------------------------------------ */
export interface InvoicePaidExtra {
  providerTxnId?: string | null;
  providerState?: number | null;
  performTime?: number | null;
  actorId?: string | null;
  req?: Request;
  note?: string | null;
}

/**
 * Hisob to'landi. Idempotent: allaqachon 'paid' bo'lsa o'zgarmaydi. Holatga bog'liq (created/pending → paid) yangilash
 * va mutaxassis muddatini uzaytirish BITTA tranzaksiyada (BEGIN IMMEDIATE) — parallel Perform/Complete/admin tasdig'ida
 * davr ikki marta qo'shilmaydi va ikki hisob bir vaqtda to'lansa ham ikkala davr ketma-ket qo'shiladi.
 */
export async function markInvoicePaid(id: string, extra: InvoicePaidExtra = {}): Promise<SubscriptionInvoice> {
  const current = await loadInvoice(id);
  if (!current) throw new ApiError(404, "Obuna hisobi topilmadi");
  if (current.state === "paid") return current;
  if (current.state === "refunded") throw new ApiError(400, "Qaytarilgan hisobni qayta tasdiqlab bo'lmaydi");
  if (current.state === "cancelled") throw new ApiError(400, "Bekor qilingan hisobni tasdiqlab bo'lmaydi");

  const settings = await getSettings();
  const now = new Date();
  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(subscriptionInvoices)
      .set({
        state: "paid",
        paidAt: now,
        updatedAt: now,
        providerState: extra.providerState ?? current.providerState ?? null,
        performTime: extra.performTime ?? current.performTime ?? now.getTime(),
        ...(extra.providerTxnId ? { providerTxnId: extra.providerTxnId } : {}),
      })
      .where(and(eq(subscriptionInvoices.id, id), inArray(subscriptionInvoices.state, [...INVOICE_OPEN_STATES])))
      .returning();
    if (!row) return null;
    // Kontaktni ochish: mijozga kontakt ochiladi (platforma tushumi, daromad taqsimoti yo'q)
    if (isContactUnlock(row)) {
      await fulfillContactUnlock(tx, row);
      return { row, sp: null };
    }
    // Mentorlik xaridi (kurs/chipta/obuna/konsultatsiya): kirish ochiladi, daromad yoziladi — mutaxassis obunasiga tegilmaydi
    if (isPurchase(row)) {
      await fulfillPurchase(tx, row);
      return { row, sp: null };
    }
    if (!row.specialistId) return { row, sp: null };
    const sp = await tx.query.specialists.findFirst({ where: eq(specialists.id, row.specialistId), columns: { id: true, userId: true, createdAt: true, subscriptionUntil: true } });
    if (!sp) return { row, sp: null };
    const { periodStart, periodEnd } = subscriptionPeriod(sp, row.months, settings, now);
    await tx.update(specialists).set({ subscriptionUntil: periodEnd, updatedAt: now }).where(eq(specialists.id, sp.id));
    const [withPeriod] = await tx.update(subscriptionInvoices).set({ periodStart, periodEnd }).where(eq(subscriptionInvoices.id, row.id)).returning();
    return { row: withPeriod ?? row, sp };
  });

  if (!result) {
    const fresh = await loadInvoice(id);
    if (fresh?.state === "paid") return fresh;
    throw new ApiError(409, "Hisob holati o'zgargan — qayta tasdiqlab bo'lmaydi");
  }
  const { row, sp } = result;
  if (isContactUnlock(row)) await afterContactPaidInvoice(row).catch((e) => console.error("[contact:after]", e));
  if (isPurchase(row)) await afterPaidInvoice(row).catch((e) => console.error("[purchase:after]", e));
  if (sp && row.periodEnd) {
    await notify(
      sp.userId,
      "subscription_paid",
      `Obuna to'landi: ${formatPrice(row.amount)}`,
      `${row.months} oylik obuna faollashtirildi — ${formatDate(row.periodEnd)} gacha. Profilingiz katalog va xaritada ko'rinadi, yangi buyurtma va takliflar ochiq.`,
      invoiceHref(row.id),
    );
  }
  await audit(
    extra.actorId ?? null,
    "subscription_paid",
    {
      targetType: "subscription_invoice",
      targetId: row.id,
      meta: { specialistId: row.specialistId, months: row.months, amount: row.amount, provider: row.provider, periodEnd: row.periodEnd?.toISOString() ?? null, note: extra.note || undefined },
    },
    extra.req,
  );
  return row;
}

/** O'tkazma: mutaxassis «To'ladim» bosdi → 'pending', adminlarga Telegramda bir bosishda tasdiqlash tugmalari bilan xabar */
export async function markInvoiceSent(invoice: SubscriptionInvoice, actorId: string, req?: Request, receiptUrl?: string | null): Promise<SubscriptionInvoice> {
  if (invoice.provider !== "manual") throw new ApiError(400, "Bu hisob provayder orqali tasdiqlanadi");
  if (invoice.state === "pending") return invoice;
  if (invoice.state !== "created") throw new ApiError(400, "Hisob holatini o'zgartirib bo'lmaydi");
  const now = new Date();
  const [row] = await db
    .update(subscriptionInvoices)
    .set({
      state: "pending",
      providerTxnId: invoice.providerTxnId ?? `manual-${invoice.id}`,
      meta: { ...invoice.meta, sentAt: now.getTime(), ...(receiptUrl ? { receiptUrl } : {}) },
      updatedAt: now,
    })
    .where(and(eq(subscriptionInvoices.id, invoice.id), eq(subscriptionInvoices.state, "created")))
    .returning();
  if (!row) {
    const fresh = await loadInvoice(invoice.id);
    if (fresh?.state === "pending") return fresh;
    throw new ApiError(409, "Hisob holati o'zgargan — sahifani yangilang");
  }
  const sp = row.specialistId
    ? await db.query.specialists.findFirst({ where: eq(specialists.id, row.specialistId), columns: { id: true }, with: { user: { columns: { name: true } } } })
    : null;
  await notifyAdminsManualPending({
    kind: "sub",
    type: "subscription_pending",
    id: row.id,
    title: "Obuna o'tkazmasi tasdiqlashni kutmoqda",
    body: isContactUnlock(row)
      ? `${contactMeta(row).title} — ${formatPrice(row.amount)} o'tkazilganini bildirdi (${invoiceNumber(row.id)}).`
      : isPurchase(row)
        ? `Mentorlik xaridi: ${purchaseMeta(row).title} — ${formatPrice(row.amount)} o'tkazilganini bildirdi (${invoiceNumber(row.id)}).`
        : `${sp?.user.name ?? "Mutaxassis"} — ${row.months} oylik obuna uchun ${formatPrice(row.amount)} o'tkazganini bildirdi (${invoiceNumber(row.id)}).`,
    href: isContactUnlock(row) ? "/admin/kontaktlar" : isPurchase(row) ? "/admin/mentorlik" : "/admin/obunalar?status=pending",
    receiptUrl,
  });
  await audit(actorId, "subscription_created", { targetType: "subscription_invoice", targetId: row.id, meta: { manualSent: true, amount: row.amount, months: row.months, receipt: Boolean(receiptUrl) } }, req);
  return row;
}

/**
 * Ochiq hisobni bekor qilish (pul harakati yo'q). Payme/Click tomonida JARAYONDAGI tranzaksiya ichkaridan yopilmaydi —
 * uni faqat provayder (CancelTransaction / Complete error) yoki 12 soatlik muddat yopadi → 409 (eskrou bilan bir xil qoida).
 * Audit — chaqiruvchi route'da (admin amali bo'lsa).
 */
export async function cancelInvoice(id: string, opts: { reason?: number | null; force?: boolean } = {}): Promise<SubscriptionInvoice> {
  const current = await loadInvoice(id);
  if (!current) throw new ApiError(404, "Obuna hisobi topilmadi");
  if (current.state === "cancelled") return current;
  if (current.state !== "created" && current.state !== "pending") throw new ApiError(400, "Bu hisobni bekor qilib bo'lmaydi");
  if (!opts.force && isProviderInFlight(current)) throw new ApiError(409, "To'lov provayder (Payme/Click) tomonida jarayonda — uni faqat provayder yopadi yoki 12 soatdan keyin eskiradi");
  const now = Date.now();
  const [row] = await db
    .update(subscriptionInvoices)
    .set({ state: "cancelled", providerState: -1, cancelTime: now, cancelReason: opts.reason ?? null, updatedAt: new Date(now) })
    .where(and(eq(subscriptionInvoices.id, id), inArray(subscriptionInvoices.state, [...INVOICE_OPEN_STATES])))
    .returning();
  if (!row) {
    const fresh = await loadInvoice(id);
    if (fresh?.state === "cancelled") return fresh;
    throw new ApiError(409, "Hisob holati o'zgargan — sahifani yangilang");
  }
  if (isPurchase(row)) await releaseHolds([row.id]);
  return row;
}

/**
 * Qaytarish (admin yoki Payme CancelTransaction, bajarilgan tranzaksiya): 'paid' → 'refunded'.
 * Mutaxassis muddati shu hisob davri uzunligiga qisqaradi, lekin hech qachon hozirgi vaqtdan pastga tushmaydi.
 */
export async function refundInvoice(id: string, actorId: string | null, opts: { reason?: number | null; req?: Request; note?: string | null } = {}): Promise<SubscriptionInvoice> {
  const current = await loadInvoice(id);
  if (!current) throw new ApiError(404, "Obuna hisobi topilmadi");
  if (current.state === "refunded") return current;
  if (current.state !== "paid") throw new ApiError(400, "Faqat to'langan hisobni qaytarish mumkin");
  const now = new Date();
  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(subscriptionInvoices)
      .set({ state: "refunded", providerState: -2, cancelTime: now.getTime(), cancelReason: opts.reason ?? 5, updatedAt: now })
      .where(and(eq(subscriptionInvoices.id, id), eq(subscriptionInvoices.state, "paid")))
      .returning();
    if (!row) return null;
    if (isContactUnlock(row)) {
      await revokeContactUnlock(tx, row);
    } else if (isPurchase(row)) {
      await revokePurchase(tx, row);
      return { row, newUntil: null as Date | null, userId: null as string | null };
    }
    let newUntil: Date | null = null;
    let userId: string | null = null;
    if (row.specialistId && row.periodStart && row.periodEnd) {
      const sp = await tx.query.specialists.findFirst({ where: eq(specialists.id, row.specialistId), columns: { id: true, userId: true, subscriptionUntil: true } });
      if (sp?.subscriptionUntil) {
        userId = sp.userId;
        const oldUntil = sp.subscriptionUntil.getTime();
        // Kalendar oy bilan orqaga (to'lashdagi addMonths'ning teskarisi), lekin hech qachon hozirdan pastga emas
        const back = addMonths(sp.subscriptionUntil, -row.months).getTime();
        const clamped = back < now.getTime();
        newUntil = new Date(clamped ? now.getTime() : back);
        const delta = oldUntil - newUntil.getTime();
        await tx.update(specialists).set({ subscriptionUntil: newUntil, updatedAt: now }).where(eq(specialists.id, sp.id));
        // Shu hisobdan KEYIN qo'shilgan to'langan davrlar ham surilib, yozuvlar yangi muddat bilan mos qoladi (chekdagi davr)
        if (delta > 0) {
          const later = await tx.query.subscriptionInvoices.findMany({
            where: and(eq(subscriptionInvoices.specialistId, sp.id), eq(subscriptionInvoices.state, "paid"), ne(subscriptionInvoices.id, row.id)),
            columns: { id: true, periodStart: true, periodEnd: true },
          });
          const shift = (d: Date) => (clamped ? new Date(d.getTime() - delta) : addMonths(d, -row.months));
          for (const l of later) {
            if (!l.periodStart || !l.periodEnd || l.periodStart.getTime() < row.periodEnd.getTime() - DAY) continue;
            await tx.update(subscriptionInvoices).set({ periodStart: shift(l.periodStart), periodEnd: shift(l.periodEnd) }).where(eq(subscriptionInvoices.id, l.id));
          }
        }
      }
    }
    return { row, newUntil, userId };
  });
  if (!result) {
    const fresh = await loadInvoice(id);
    if (fresh?.state === "refunded") return fresh;
    throw new ApiError(409, "Hisob holati o'zgargan — sahifani yangilang");
  }
  const { row, newUntil, userId } = result;
  if (isContactUnlock(row) && row.userId) {
    await notify(row.userId, "payment_refunded", `To'lov qaytarildi: ${formatPrice(row.amount)}`, `${contactMeta(row).title} bo'yicha to'lov qaytarildi, kontakt yopildi.`, contactHref(row.id));
  } else if (isPurchase(row) && row.userId) {
    await notify(row.userId, "payment_refunded", `To'lov qaytarildi: ${formatPrice(row.amount)}`, `${purchaseMeta(row).title} bo'yicha to'lov qaytarildi, kirish yopildi.`, purchaseHref(row.id));
  }
  if (userId) {
    await notify(
      userId,
      "payment_refunded",
      `Obuna to'lovi qaytarildi: ${formatPrice(row.amount)}`,
      `${invoiceNumber(row.id)} (${row.months} oy) bo'yicha to'lov qaytarildi.${newUntil ? ` Obuna muddati: ${formatDate(newUntil)} gacha.` : ""}`,
      invoiceHref(row.id),
    );
  }
  if (!actorId) {
    await notifyAdmins("refund_needed", "Payme obuna to'lovini bekor qildi", `${invoiceNumber(row.id)} — ${formatPrice(row.amount)} provayder tomonidan qaytarildi, obuna muddati qisqartirildi.`, "/admin/obunalar", {
      dedupeMs: 6 * 60 * 60 * 1000,
    });
  }
  await audit(
    actorId,
    actorId ? "admin_subscription" : "payment_refunded",
    { targetType: "subscription_invoice", targetId: row.id, meta: { action: "refund", amount: row.amount, months: row.months, until: newUntil?.toISOString() ?? null, reason: opts.reason ?? null, note: opts.note || undefined } },
    opts.req,
  );
  return row;
}

/**
 * Admin: obunani qo'lda N kunga uzaytirish (bonus, kompensatsiya, naqd to'lov). max(now, joriy until) + days.
 * Pul harakati emas — hisob yaratilmaydi, audit jurnaliga yoziladi.
 */
export async function adminExtend(specialistId: string, days: number, opts: { actorId: string; note?: string | null; req?: Request }): Promise<{ until: Date; previous: Date }> {
  if (!Number.isInteger(days) || days < 1 || days > 730) throw new ApiError(422, "Kunlar soni 1–730 oralig'ida bo'lsin", { days: "1–730" });
  const settings = await getSettings();
  const now = new Date();
  const res = await db.transaction(async (tx) => {
    const sp = await tx.query.specialists.findFirst({ where: eq(specialists.id, specialistId), columns: { id: true, userId: true, createdAt: true, subscriptionUntil: true } });
    if (!sp) return null;
    const previous = subscriptionState(sp, settings, now).until;
    const until = new Date(Math.max(now.getTime(), previous.getTime()) + days * DAY);
    await tx.update(specialists).set({ subscriptionUntil: until, updatedAt: now }).where(eq(specialists.id, sp.id));
    return { until, previous, userId: sp.userId };
  });
  if (!res) throw new ApiError(404, "Mutaxassis topilmadi");
  await notify(res.userId, "subscription_paid", `Obuna ${days} kunga uzaytirildi`, `Administrator obunangizni uzaytirdi — endi ${formatDate(res.until)} gacha faol.${opts.note ? ` Izoh: ${opts.note}` : ""}`, SUBSCRIPTION_HREF);
  await audit(opts.actorId, "admin_subscription", { targetType: "specialist", targetId: specialistId, meta: { action: "extend", days, from: res.previous.toISOString(), until: res.until.toISOString(), note: opts.note || undefined } }, opts.req);
  return { until: res.until, previous: res.previous };
}


/**
 * Payme/Click 'pending' hisoblari 12 soatdan eskirgan bo'lsa — bekor (provayder holati -1, sabab 4).
 * Cron (yoki eslatmalar) chaqiradi; Payme CheckTransaction/CreateTransaction ham o'zi tekshiradi.
 */
export async function expireStaleInvoices(now = Date.now(), dry = false): Promise<number> {
  const rows = await db.query.subscriptionInvoices.findMany({
    where: and(eq(subscriptionInvoices.state, "pending"), ne(subscriptionInvoices.provider, "manual")),
    columns: { id: true, provider: true, state: true, providerCreateTime: true, createdAt: true },
  });
  const stale = rows.filter((r) => !isProviderInFlight(r, now)).map((r) => r.id);
  if (!stale.length || dry) return stale.length;
  await db
    .update(subscriptionInvoices)
    .set({ state: "cancelled", providerState: -1, cancelTime: now, cancelReason: 4, updatedAt: new Date(now) })
    .where(and(inArray(subscriptionInvoices.id, stale), eq(subscriptionInvoices.state, "pending")));
  await releaseHolds(stale);
  return stale.length;
}

/** Mutaxassisning so'nggi to'langan hisobi (davr uzunligi — progress halqasi uchun) */
export async function lastPaidInvoice(specialistId: string): Promise<SubscriptionInvoice | null> {
  return (
    (await db.query.subscriptionInvoices.findFirst({
      where: and(eq(subscriptionInvoices.specialistId, specialistId), eq(subscriptionInvoices.state, "paid")),
      orderBy: [desc(subscriptionInvoices.paidAt)],
    })) ?? null
  );
}
