import "server-only";
import { and, asc, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  courses,
  enrollments,
  liveStreams,
  liveTickets,
  mentorEarnings,
  mentorPayouts,
  mentorSlots,
  mentorSubs,
  mentors,
  promoCodes,
  refCodes,
  referralRewards,
  subscriptionInvoices,
  users,
  type SubscriptionInvoice,
} from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { notify } from "@/lib/notifications";
import { uid, formatPrice } from "@/lib/utils";
import type { PaymentProvider } from "@/lib/constants";
import { isProviderConfigured } from "@/lib/payments/config";
import { luhnValid, cardDigits } from "@/lib/payments/card";
import { EARNING_HOLD_DAYS, MENTOR_FEE_PCT, MIN_PAYOUT, SLOT_HOLD_MS, SUB_DAYS, type PurchaseType } from "./format";

/**
 * Mentorlik to'lovlari — kurs, efir chiptasi, oylik obuna, 1:1 konsultatsiya.
 * Pul oqimi MAVJUD hisob tizimiga (subscription_invoices) ulanadi: meta.kind = "purchase", hisob id'si "sub_…" prefiksi bilan,
 * shuning uchun Payme/Click webhook'lari va qo'lda tasdiqlash o'zgarishsiz ishlaydi. Faqat to'langanda (markInvoicePaid)
 * fulfillPurchase chaqiriladi: kirish ochiladi + mentor daromadi yoziladi (7 kun ushlab turiladi — eskrou kabi).
 */

export type PurchaseMeta = {
  kind: "purchase";
  type: PurchaseType;
  itemId: string;
  mentorId: string;
  courseId?: string;
  title: string;
  base: number;
  promoId?: string;
  promoCode?: string;
  promoDiscount?: number;
  refCode?: string;
  refReferrerId?: string;
  refPct?: number;
  refDiscount?: number;
  creditUsed?: number;
};

/** SQL sharti: mutaxassis obunasi hisoblari (mentorlik xaridlari va kontakt ochish EMAS) — obuna hisobotlari/analitika uchun */
export const notPurchaseSql = sql`coalesce(json_extract(${subscriptionInvoices.meta}, '$.kind'), '') not in ('purchase', 'contact')`;

export const isPurchase = (i: Pick<SubscriptionInvoice, "meta">): boolean => (i.meta as { kind?: string } | null)?.kind === "purchase";
export const purchaseMeta = (i: Pick<SubscriptionInvoice, "meta">) => i.meta as unknown as PurchaseMeta;
export const purchaseHref = (id: string) => `/mentorlik/tolov/${encodeURIComponent(id)}`;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/* ------------------------------------------------------------------ */
/* Narx hisoblash                                                      */
/* ------------------------------------------------------------------ */
interface Quote {
  type: PurchaseType;
  itemId: string;
  mentorId: string;
  mentorUserId: string;
  courseId?: string;
  title: string;
  base: number;
}

export async function quoteItem(type: PurchaseType, id: string, buyerId: string): Promise<Quote> {
  if (type === "course") {
    const c = await db.query.courses.findFirst({ where: eq(courses.id, id), with: { mentor: { columns: { id: true, userId: true } } } });
    if (!c || !c.isPublished) throw new ApiError(404, "Kurs topilmadi");
    if (c.mentor.userId === buyerId) throw new ApiError(400, "O'z kursingizni sotib ololmaysiz");
    const has = await db.query.enrollments.findFirst({ where: and(eq(enrollments.courseId, id), eq(enrollments.userId, buyerId)) });
    if (has) throw new ApiError(409, "Siz bu kursga allaqachon yozilgansiz");
    return { type, itemId: id, mentorId: c.mentor.id, mentorUserId: c.mentor.userId, courseId: c.id, title: c.title, base: c.priceFrom };
  }
  if (type === "ticket") {
    const s = await db.query.liveStreams.findFirst({ where: eq(liveStreams.id, id) });
    if (!s || s.priceSom <= 0) throw new ApiError(404, "Efir topilmadi yoki bepul");
    const m = await db.query.mentors.findFirst({ where: eq(mentors.channelId, s.groupId), columns: { id: true, userId: true } });
    if (!m) throw new ApiError(400, "Chipta faqat ustoz efirlari uchun");
    if (m.userId === buyerId) throw new ApiError(400, "O'z efiringiz uchun chipta olmaysiz");
    if (await db.query.liveTickets.findFirst({ where: and(eq(liveTickets.streamId, id), eq(liveTickets.userId, buyerId)) })) throw new ApiError(409, "Sizda bu efirga chipta bor");
    return { type, itemId: id, mentorId: m.id, mentorUserId: m.userId, title: s.title, base: s.priceSom };
  }
  if (type === "sub") {
    const m = await db.query.mentors.findFirst({ where: eq(mentors.id, id), with: { user: { columns: { name: true } } } });
    if (!m || !m.isApproved || m.subPrice <= 0) throw new ApiError(404, "Bu ustozda obuna yo'q");
    if (m.userId === buyerId) throw new ApiError(400, "O'zingizga obuna bo'lolmaysiz");
    return { type, itemId: id, mentorId: m.id, mentorUserId: m.userId, title: `Oylik obuna — ${m.user.name}`, base: m.subPrice };
  }
  const slot = await db.query.mentorSlots.findFirst({ where: eq(mentorSlots.id, id), with: { mentor: { columns: { id: true, userId: true } } } });
  if (!slot || slot.status === "cancelled" || slot.startsAt.getTime() < Date.now()) throw new ApiError(404, "Bu vaqt endi mavjud emas");
  if (slot.mentor.userId === buyerId) throw new ApiError(400, "O'z vaqtingizni band qilolmaysiz");
  return { type: "consult", itemId: id, mentorId: slot.mentor.id, mentorUserId: slot.mentor.userId, title: `Konsultatsiya (${slot.durationMin} daq)`, base: slot.priceSom };
}

export interface PriceBreakdown {
  base: number;
  promo: { id: string; code: string; percent: number; discount: number } | null;
  ref: { code: string; referrerId: string; percent: number; discount: number } | null;
  creditUsed: number;
  creditIds: string[];
  amount: number;
}

/** Foydalanuvchining ishlatish mumkin bo'lgan tavsiya krediti (band qilinmagan, bekor qilinmagan) */
export async function creditBalance(userId: string): Promise<number> {
  const [r] = await db
    .select({ s: sql<number>`coalesce(sum(${referralRewards.amount}),0)` })
    .from(referralRewards)
    .where(and(eq(referralRewards.referrerId, userId), eq(referralRewards.voided, false), isNull(referralRewards.consumedInvoiceId)));
  return Number(r?.s ?? 0);
}

export async function priceFor(q: Quote, buyerId: string, opts: { promo?: string; ref?: string; useCredit?: boolean }): Promise<PriceBreakdown> {
  let promo: PriceBreakdown["promo"] = null;
  const code = opts.promo?.trim().toUpperCase();
  if (code) {
    const p = await db.query.promoCodes.findFirst({ where: eq(promoCodes.code, code) });
    const ok =
      p &&
      p.isActive &&
      p.mentorId === q.mentorId &&
      (!p.courseId || p.courseId === q.courseId) &&
      (!p.expiresAt || p.expiresAt.getTime() > Date.now()) &&
      (p.maxUses == null || p.uses < p.maxUses);
    if (!p || !ok) throw new ApiError(422, "Promokod yaroqsiz yoki muddati o'tgan", { promo: "Promokod yaroqsiz" });
    promo = { id: p.id, code: p.code, percent: p.percent, discount: Math.floor((q.base * p.percent) / 100) };
  }

  let ref: PriceBreakdown["ref"] = null;
  const refCode = opts.ref?.trim().toUpperCase();
  if (refCode && !promo) {
    const rc = await db.query.refCodes.findFirst({ where: eq(refCodes.code, refCode) });
    // Faqat birinchi xarid uchun va o'z kodingiz emas
    const prev = await db
      .select({ n: sql<number>`count(*)` })
      .from(subscriptionInvoices)
      .where(and(eq(subscriptionInvoices.userId, buyerId), eq(subscriptionInvoices.state, "paid"), sql`json_extract(${subscriptionInvoices.meta}, '$.kind') = 'purchase'`));
    if (rc && rc.userId !== buyerId && Number(prev[0]?.n ?? 0) === 0) {
      const m = await db.query.mentors.findFirst({ where: eq(mentors.id, q.mentorId), columns: { refPercent: true } });
      const pct = m?.refPercent ?? 0;
      if (pct > 0) ref = { code: rc.code, referrerId: rc.userId, percent: pct, discount: Math.floor((q.base * pct) / 100) };
    }
  }

  let amount = Math.max(0, q.base - (promo?.discount ?? 0) - (ref?.discount ?? 0));
  let creditUsed = 0;
  const creditIds: string[] = [];
  if (opts.useCredit && amount > 0) {
    const cap = Math.floor(amount / 2);
    const rows = await db.query.referralRewards.findMany({
      where: and(eq(referralRewards.referrerId, buyerId), eq(referralRewards.voided, false), isNull(referralRewards.consumedInvoiceId)),
      orderBy: [asc(referralRewards.createdAt)],
    });
    for (const r of rows) {
      if (creditUsed + r.amount > cap) continue;
      creditUsed += r.amount;
      creditIds.push(r.id);
    }
    amount -= creditUsed;
  }
  return { base: q.base, promo, ref, creditUsed, creditIds, amount };
}

/* ------------------------------------------------------------------ */
/* Xarid boshlash                                                      */
/* ------------------------------------------------------------------ */
const newInvoiceId = () => `sub_${crypto.randomUUID()}`;

export type StartResult = { free: true; type: PurchaseType; itemId: string } | { free: false; invoice: SubscriptionInvoice };

export async function startPurchase(
  buyer: { id: string },
  input: { type: PurchaseType; id: string; provider: PaymentProvider; promo?: string; ref?: string; useCredit?: boolean },
): Promise<StartResult> {
  const q = await quoteItem(input.type, input.id, buyer.id);
  const price = await priceFor(q, buyer.id, input);
  const meta: PurchaseMeta = {
    kind: "purchase",
    type: q.type,
    itemId: q.itemId,
    mentorId: q.mentorId,
    courseId: q.courseId,
    title: q.title,
    base: q.base,
    ...(price.promo ? { promoId: price.promo.id, promoCode: price.promo.code, promoDiscount: price.promo.discount } : {}),
    ...(price.ref ? { refCode: price.ref.code, refReferrerId: price.ref.referrerId, refPct: price.ref.percent, refDiscount: price.ref.discount } : {}),
    ...(price.creditUsed ? { creditUsed: price.creditUsed } : {}),
  };

  // To'lovsiz (bepul kurs/chipta yoki 100% chegirma): hisob ochilmaydi, kirish darhol beriladi
  if (price.amount <= 0) {
    if (q.type === "sub" || q.type === "consult") throw new ApiError(400, "Bu xarid uchun to'lov kerak");
    await db.transaction(async (tx) => {
      await grantAccess(tx, q.type, q.itemId, buyer.id, q.mentorId);
      if (price.promo) await tx.update(promoCodes).set({ uses: sql`${promoCodes.uses} + 1` }).where(eq(promoCodes.id, price.promo.id));
    });
    await afterPaid(buyer.id, q.mentorUserId, q.type, q.title, 0, null);
    return { free: true, type: q.type, itemId: q.itemId };
  }
  if (price.amount < 1000) throw new ApiError(422, "Summa juda kichik — promokoddan voz kechib ko'ring");
  if (!(await isProviderConfigured(input.provider))) throw new ApiError(400, "Bu to'lov usuli hozircha ulanmagan");

  // Eski yopilmagan (yuborilmagan) xaridlarni tozalaymiz — band qilingan vaqt/kredit bo'shaydi
  const stale = await db.query.subscriptionInvoices.findMany({
    where: and(eq(subscriptionInvoices.userId, buyer.id), eq(subscriptionInvoices.state, "created"), sql`json_extract(${subscriptionInvoices.meta}, '$.kind') = 'purchase'`),
    columns: { id: true },
  });
  if (stale.length) {
    await db.update(subscriptionInvoices).set({ state: "cancelled", providerState: -1, cancelTime: Date.now(), cancelReason: 4, updatedAt: new Date() }).where(inArray(subscriptionInvoices.id, stale.map((s) => s.id)));
    await releaseHolds(stale.map((s) => s.id));
  }

  const id = newInvoiceId();
  if (q.type === "consult") {
    // CAS: bo'sh (yoki muddati o'tgan band) vaqtni 20 daqiqaga ushlaymiz
    const now = Date.now();
    const held = await db
      .update(mentorSlots)
      .set({ status: "held", invoiceId: id, bookedBy: buyer.id, heldUntil: new Date(now + SLOT_HOLD_MS) })
      .where(and(eq(mentorSlots.id, q.itemId), or(eq(mentorSlots.status, "open"), and(eq(mentorSlots.status, "held"), lt(mentorSlots.heldUntil, new Date(now))))))
      .returning({ id: mentorSlots.id });
    if (!held.length) throw new ApiError(409, "Bu vaqtni boshqa kishi band qilgan");
  }
  if (price.creditIds.length) {
    const taken = await db
      .update(referralRewards)
      .set({ consumedInvoiceId: id })
      .where(and(inArray(referralRewards.id, price.creditIds), isNull(referralRewards.consumedInvoiceId)))
      .returning({ id: referralRewards.id });
    if (taken.length !== price.creditIds.length) {
      await releaseHolds([id]);
      throw new ApiError(409, "Kredit holati o'zgardi — qayta urinib ko'ring");
    }
  }
  const [invoice] = await db
    .insert(subscriptionInvoices)
    .values({ id, specialistId: null, userId: buyer.id, months: 0, amount: price.amount, provider: input.provider, state: "created", meta: meta as unknown as Record<string, unknown> })
    .returning();
  return { free: false, invoice };
}

/** Yopilgan (bekor/eskirgan) xarid hisoblari: band vaqt va kredit bo'shatiladi */
export async function releaseHolds(invoiceIds: string[]): Promise<void> {
  if (!invoiceIds.length) return;
  await db.update(mentorSlots).set({ status: "open", invoiceId: null, bookedBy: null, heldUntil: null }).where(and(inArray(mentorSlots.invoiceId, invoiceIds), eq(mentorSlots.status, "held")));
  await db.update(referralRewards).set({ consumedInvoiceId: null }).where(inArray(referralRewards.consumedInvoiceId, invoiceIds));
}

/* ------------------------------------------------------------------ */
/* To'langanda / qaytarilganda                                         */
/* ------------------------------------------------------------------ */
async function grantAccess(tx: Tx, type: PurchaseType, itemId: string, userId: string, mentorId: string, invoiceId?: string): Promise<void> {
  if (type === "course") {
    const has = await tx.query.enrollments.findFirst({ where: and(eq(enrollments.courseId, itemId), eq(enrollments.userId, userId)), columns: { id: true } });
    if (!has) {
      await tx.insert(enrollments).values({ id: uid(), courseId: itemId, userId });
      await tx.update(courses).set({ studentsCount: sql`${courses.studentsCount} + 1` }).where(eq(courses.id, itemId));
      await tx.update(mentors).set({ studentsCount: sql`${mentors.studentsCount} + 1` }).where(eq(mentors.id, mentorId));
    }
  } else if (type === "ticket") {
    await tx.insert(liveTickets).values({ streamId: itemId, userId }).onConflictDoNothing();
  } else if (type === "sub") {
    const cur = await tx.query.mentorSubs.findFirst({ where: and(eq(mentorSubs.userId, userId), eq(mentorSubs.mentorId, mentorId)) });
    const from = Math.max(Date.now(), cur?.until.getTime() ?? 0);
    const until = new Date(from + SUB_DAYS * 86_400_000);
    if (cur) await tx.update(mentorSubs).set({ until }).where(eq(mentorSubs.id, cur.id));
    else await tx.insert(mentorSubs).values({ id: uid(), userId, mentorId, until });
  } else if (type === "consult" && invoiceId) {
    await tx.update(mentorSlots).set({ status: "booked", bookedBy: userId, heldUntil: null }).where(and(eq(mentorSlots.id, itemId), eq(mentorSlots.invoiceId, invoiceId)));
  }
}

/** markInvoicePaid tranzaksiyasi ichida (bir marta): kirish ochiladi, daromad yoziladi, promokod/tavsiya hisoblanadi */
export async function fulfillPurchase(tx: Tx, inv: SubscriptionInvoice): Promise<void> {
  const m = purchaseMeta(inv);
  if (!inv.userId) return;
  await grantAccess(tx, m.type, m.itemId, inv.userId, m.mentorId, inv.id);
  const fee = Math.floor((inv.amount * MENTOR_FEE_PCT) / 100);
  await tx
    .insert(mentorEarnings)
    .values({ id: uid(), mentorId: m.mentorId, invoiceId: inv.id, kind: m.type, title: m.title.slice(0, 120), gross: inv.amount, fee, net: inv.amount - fee, availableAt: new Date(Date.now() + EARNING_HOLD_DAYS * 86_400_000) })
    .onConflictDoNothing();
  if (m.promoId) await tx.update(promoCodes).set({ uses: sql`${promoCodes.uses} + 1` }).where(eq(promoCodes.id, m.promoId));
  if (m.refReferrerId && m.refPct && m.refDiscount) {
    await tx.insert(referralRewards).values({ id: uid(), referrerId: m.refReferrerId, buyerId: inv.userId, invoiceId: inv.id, amount: m.refDiscount }).onConflictDoNothing();
  }
}

/** Qaytarish (refundInvoice tranzaksiyasi ichida) */
export async function revokePurchase(tx: Tx, inv: SubscriptionInvoice): Promise<void> {
  const m = purchaseMeta(inv);
  if (inv.userId) {
    if (m.type === "course") {
      const del = await tx.delete(enrollments).where(and(eq(enrollments.courseId, m.itemId), eq(enrollments.userId, inv.userId))).returning({ id: enrollments.id });
      if (del.length) {
        await tx.update(courses).set({ studentsCount: sql`max(${courses.studentsCount} - 1, 0)` }).where(eq(courses.id, m.itemId));
        await tx.update(mentors).set({ studentsCount: sql`max(${mentors.studentsCount} - 1, 0)` }).where(eq(mentors.id, m.mentorId));
      }
    } else if (m.type === "ticket") {
      await tx.delete(liveTickets).where(and(eq(liveTickets.streamId, m.itemId), eq(liveTickets.userId, inv.userId)));
    } else if (m.type === "sub") {
      const cur = await tx.query.mentorSubs.findFirst({ where: and(eq(mentorSubs.userId, inv.userId), eq(mentorSubs.mentorId, m.mentorId)) });
      if (cur) await tx.update(mentorSubs).set({ until: new Date(Math.max(Date.now(), cur.until.getTime() - SUB_DAYS * 86_400_000)) }).where(eq(mentorSubs.id, cur.id));
    } else if (m.type === "consult") {
      await tx.update(mentorSlots).set({ status: "open", invoiceId: null, bookedBy: null, heldUntil: null }).where(eq(mentorSlots.invoiceId, inv.id));
    }
  }
  await tx.update(mentorEarnings).set({ status: "refunded" }).where(eq(mentorEarnings.invoiceId, inv.id));
  await tx.update(referralRewards).set({ voided: true }).where(eq(referralRewards.invoiceId, inv.id));
}

/** To'lovdan keyin bildirishnomalar (tranzaksiyadan tashqarida) */
export async function afterPaid(buyerId: string, mentorUserId: string, type: PurchaseType, title: string, amount: number, invoiceId: string | null): Promise<void> {
  const href = type === "ticket" ? "/mentorlik" : "/kabinet/mentorlik";
  await notify(buyerId, "subscription_paid", amount ? `To'lov qabul qilindi: ${formatPrice(amount)}` : "Kirish ochildi", `${title} — endi sizga ochiq.`, invoiceId ? purchaseHref(invoiceId) : href).catch(() => undefined);
  await notify(mentorUserId, "subscription_paid", amount ? `Yangi sotuv: ${formatPrice(amount)}` : "Yangi talaba", `${title}${amount ? ` — daromadingiz 7 kundan keyin yechishga ochiladi.` : ""}`, "/kabinet/mentorlik/daromad", { skipMail: true }).catch(() => undefined);
}

export async function afterPaidInvoice(inv: SubscriptionInvoice): Promise<void> {
  const m = purchaseMeta(inv);
  const mentor = await db.query.mentors.findFirst({ where: eq(mentors.id, m.mentorId), columns: { userId: true } });
  if (inv.userId && mentor) await afterPaid(inv.userId, mentor.userId, m.type, m.title, inv.amount, inv.id);
}

/* ------------------------------------------------------------------ */
/* Kirish tekshiruvlari                                                */
/* ------------------------------------------------------------------ */
export async function hasActiveSub(userId: string, mentorId: string): Promise<boolean> {
  const s = await db.query.mentorSubs.findFirst({ where: and(eq(mentorSubs.userId, userId), eq(mentorSubs.mentorId, mentorId), gt(mentorSubs.until, new Date())), columns: { id: true } });
  return Boolean(s);
}

/** Narxli efir/yozuvga kirish: chipta yoki mentor obunasi (yoki mentor/admin) */
export async function canWatchPaid(userId: string | null, stream: { id: string; groupId: string; priceSom: number }, admin: boolean): Promise<boolean> {
  if (stream.priceSom <= 0 || admin) return true;
  if (!userId) return false;
  const m = await db.query.mentors.findFirst({ where: eq(mentors.channelId, stream.groupId), columns: { id: true, userId: true } });
  if (m?.userId === userId) return true;
  if (await db.query.liveTickets.findFirst({ where: and(eq(liveTickets.streamId, stream.id), eq(liveTickets.userId, userId)), columns: { userId: true } })) return true;
  return m ? hasActiveSub(userId, m.id) : false;
}

/* ------------------------------------------------------------------ */
/* Mentor daromadi va yechish                                          */
/* ------------------------------------------------------------------ */
export async function mentorBalance(mentorId: string) {
  await db.update(mentorEarnings).set({ status: "available" }).where(and(eq(mentorEarnings.mentorId, mentorId), eq(mentorEarnings.status, "pending"), lt(mentorEarnings.availableAt, new Date())));
  const rows = await db
    .select({ status: mentorEarnings.status, net: sql<number>`coalesce(sum(${mentorEarnings.net}),0)`, gross: sql<number>`coalesce(sum(${mentorEarnings.gross}),0)`, n: sql<number>`count(*)` })
    .from(mentorEarnings)
    .where(eq(mentorEarnings.mentorId, mentorId))
    .groupBy(mentorEarnings.status);
  const by = (s: string) => Number(rows.find((r) => r.status === s)?.net ?? 0);
  const salesRows = rows.filter((r) => r.status !== "refunded");
  return {
    pending: by("pending"),
    available: by("available"),
    paidOut: by("paid_out"),
    gross: salesRows.reduce((a, r) => a + Number(r.gross), 0),
    sales: salesRows.reduce((a, r) => a + Number(r.n), 0),
  };
}

export async function listEarnings(mentorId: string, limit = 40) {
  return db.query.mentorEarnings.findMany({ where: eq(mentorEarnings.mentorId, mentorId), orderBy: [desc(mentorEarnings.createdAt)], limit });
}

export async function listPayouts(mentorId: string, limit = 20) {
  return db.query.mentorPayouts.findMany({ where: eq(mentorPayouts.mentorId, mentorId), orderBy: [desc(mentorPayouts.createdAt)], limit });
}

export async function requestPayout(mentorId: string, mentorUserId: string, cardInput: string) {
  const card = cardDigits(cardInput);
  if (card.length < 16 || !luhnValid(card)) throw new ApiError(422, "Karta raqami noto'g'ri", { card: "Karta raqamini tekshiring" });
  const bal = await mentorBalance(mentorId);
  if (bal.available < MIN_PAYOUT) throw new ApiError(400, `Yechish uchun kamida ${formatPrice(MIN_PAYOUT)} bo'lishi kerak`);
  const payoutId = uid();
  const taken = await db.transaction(async (tx) => {
    const rows = await tx
      .update(mentorEarnings)
      .set({ status: "paid_out", payoutId })
      .where(and(eq(mentorEarnings.mentorId, mentorId), eq(mentorEarnings.status, "available")))
      .returning({ net: mentorEarnings.net });
    const amount = rows.reduce((a, r) => a + r.net, 0);
    if (amount < MIN_PAYOUT) throw new ApiError(400, "Yechish uchun mablag' yetarli emas");
    await tx.insert(mentorPayouts).values({ id: payoutId, mentorId, amount, card });
    return amount;
  });
  const { notifyAdmins } = await import("@/lib/notifications");
  await notifyAdmins("refund_needed", `Mentor yechish so'rovi: ${formatPrice(taken)}`, "Mentorlik → Yechish so'rovlari bo'limida kartaga o'tkazing.", "/admin/mentorlik", { dedupeMs: 60_000 }).catch(() => undefined);
  void mentorUserId;
  return { payoutId, amount: taken };
}

export async function resolvePayout(payoutId: string, action: "paid" | "rejected", note?: string) {
  const p = await db.query.mentorPayouts.findFirst({ where: eq(mentorPayouts.id, payoutId), with: { mentor: { columns: { userId: true } } } });
  if (!p) throw new ApiError(404, "So'rov topilmadi");
  const claimed = await db.update(mentorPayouts).set({ status: action, note: note ?? null, resolvedAt: new Date() }).where(and(eq(mentorPayouts.id, payoutId), eq(mentorPayouts.status, "requested"))).returning({ id: mentorPayouts.id });
  if (!claimed.length) throw new ApiError(409, "So'rov allaqachon hal qilingan");
  if (action === "rejected") await db.update(mentorEarnings).set({ status: "available", payoutId: null }).where(eq(mentorEarnings.payoutId, payoutId));
  await notify(p.mentor.userId, "subscription_paid", action === "paid" ? `Pul kartangizga o'tkazildi: ${formatPrice(p.amount)}` : "Yechish so'rovi rad etildi", note || (action === "paid" ? "Mablag' kartaga yuborildi." : "Mablag' balansingizga qaytdi."), "/kabinet/mentorlik/daromad", { skipMail: true }).catch(() => undefined);
}

export async function listOpenPayouts() {
  return db.query.mentorPayouts.findMany({ where: eq(mentorPayouts.status, "requested"), orderBy: [asc(mentorPayouts.createdAt)], with: { mentor: { columns: { id: true }, with: { user: { columns: { name: true } } } } } });
}

/* ------------------------------------------------------------------ */
/* Promokodlar, tavsiya, konsultatsiya vaqtlari                        */
/* ------------------------------------------------------------------ */
export async function listPromos(mentorId: string) {
  return db.query.promoCodes.findMany({ where: eq(promoCodes.mentorId, mentorId), orderBy: [desc(promoCodes.createdAt)] });
}

export async function createPromo(mentorId: string, input: { code: string; percent: number; courseId?: string | null; maxUses?: number | null; days?: number | null }) {
  const code = input.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  if (code.length < 3 || code.length > 20) throw new ApiError(422, "Kod 3–20 belgi (harf/raqam)", { code: "3–20 belgi" });
  if (!Number.isInteger(input.percent) || input.percent < 1 || input.percent > 100) throw new ApiError(422, "Chegirma 1–100%", { percent: "1–100" });
  if (input.courseId) {
    const c = await db.query.courses.findFirst({ where: and(eq(courses.id, input.courseId), eq(courses.mentorId, mentorId)), columns: { id: true } });
    if (!c) throw new ApiError(404, "Kurs topilmadi");
  }
  const exists = await db.query.promoCodes.findFirst({ where: eq(promoCodes.code, code), columns: { id: true } });
  if (exists) throw new ApiError(409, "Bu kod band — boshqasini tanlang", { code: "Band" });
  const expiresAt = input.days ? new Date(Date.now() + input.days * 86_400_000) : null;
  await db.insert(promoCodes).values({ id: uid(), mentorId, code, percent: input.percent, courseId: input.courseId ?? null, maxUses: input.maxUses ?? null, expiresAt });
}

export async function setPromoActive(mentorId: string, id: string, active: boolean) {
  await db.update(promoCodes).set({ isActive: active }).where(and(eq(promoCodes.id, id), eq(promoCodes.mentorId, mentorId)));
}

/** Foydalanuvchining tavsiya kodi (birinchi so'rovda yaratiladi) */
export async function myRefCode(userId: string): Promise<string> {
  const cur = await db.query.refCodes.findFirst({ where: eq(refCodes.userId, userId) });
  if (cur) return cur.code;
  for (let i = 0; i < 5; i++) {
    const code = crypto.randomUUID().replace(/-/g, "").slice(0, 7).toUpperCase();
    try {
      await db.insert(refCodes).values({ userId, code });
      return code;
    } catch {
      const again = await db.query.refCodes.findFirst({ where: eq(refCodes.userId, userId) });
      if (again) return again.code;
    }
  }
  throw new ApiError(500, "Kod yaratilmadi");
}

export async function referralStats(userId: string) {
  const rows = await db.query.referralRewards.findMany({ where: and(eq(referralRewards.referrerId, userId), eq(referralRewards.voided, false)) });
  return { invited: rows.length, earned: rows.reduce((a, r) => a + r.amount, 0), balance: await creditBalance(userId) };
}

export async function listSlots(mentorId: string, manage: boolean) {
  const now = new Date();
  const rows = await db.query.mentorSlots.findMany({
    where: and(eq(mentorSlots.mentorId, mentorId), gt(mentorSlots.startsAt, manage ? new Date(now.getTime() - 3_600_000) : now), manage ? undefined : or(eq(mentorSlots.status, "open"), and(eq(mentorSlots.status, "held"), lt(mentorSlots.heldUntil, now)))),
    orderBy: [asc(mentorSlots.startsAt)],
    limit: 60,
  });
  return rows;
}

export async function createSlot(mentorId: string, input: { startsAt: number; durationMin: number; priceSom: number; note?: string }) {
  if (!Number.isFinite(input.startsAt) || input.startsAt < Date.now() + 30 * 60_000) throw new ApiError(422, "Vaqt kamida 30 daqiqadan keyin bo'lsin", { startsAt: "Kelajakdagi vaqt" });
  if (![15, 30, 45, 60, 90].includes(input.durationMin)) throw new ApiError(422, "Davomiylik 15/30/45/60/90 daqiqa", { durationMin: "15–90" });
  if (!Number.isInteger(input.priceSom) || input.priceSom < 5000 || input.priceSom > 5_000_000) throw new ApiError(422, "Narx 5 000 – 5 000 000 so'm", { priceSom: "5 000 – 5 000 000" });
  await db.insert(mentorSlots).values({ id: uid(), mentorId, startsAt: new Date(input.startsAt), durationMin: input.durationMin, priceSom: input.priceSom, note: (input.note ?? "").slice(0, 200) });
}

export async function cancelSlot(mentorId: string, id: string) {
  const s = await db.query.mentorSlots.findFirst({ where: and(eq(mentorSlots.id, id), eq(mentorSlots.mentorId, mentorId)) });
  if (!s) throw new ApiError(404, "Vaqt topilmadi");
  if (s.status === "booked") throw new ApiError(409, "Band qilingan vaqtni bekor qilib bo'lmaydi — talaba bilan kelishing");
  await db.update(mentorSlots).set({ status: "cancelled" }).where(eq(mentorSlots.id, id));
}

/** Mening band qilingan konsultatsiyalarim (talaba) yoki mentor sifatida */
export async function myConsults(userId: string, mentorId: string | null) {
  const rows = await db.query.mentorSlots.findMany({
    where: and(eq(mentorSlots.status, "booked"), mentorId ? or(eq(mentorSlots.bookedBy, userId), eq(mentorSlots.mentorId, mentorId)) : eq(mentorSlots.bookedBy, userId), gt(mentorSlots.startsAt, new Date(Date.now() - 6 * 3_600_000))),
    orderBy: [asc(mentorSlots.startsAt)],
    with: { mentor: { columns: { id: true, userId: true, slug: true }, with: { user: { columns: { name: true } } } } },
  });
  const buyerIds = rows.map((r) => r.bookedBy).filter((x): x is string => Boolean(x));
  const buyers = buyerIds.length ? await db.query.users.findMany({ where: inArray(users.id, buyerIds), columns: { id: true, name: true } }) : [];
  const bmap = new Map(buyers.map((b) => [b.id, b.name]));
  return rows.map((r) => ({ ...r, buyerName: r.bookedBy ? (bmap.get(r.bookedBy) ?? "Talaba") : "" }));
}
