import "server-only";
import { isPurchase } from "@/lib/mentorship/purchases";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, payments, subscriptionInvoices, type Payment, type SubscriptionInvoice } from "@/lib/db/schema";
import { notifyAdmins } from "@/lib/notifications";
import { isInvoiceId, loadInvoice, markInvoicePaid, refundInvoice } from "@/lib/subscriptions/billing";
import { formatPrice, uid } from "@/lib/utils";
import { paymentsEnv, safeEqual } from "./config";
import { getSettings, splitAmount } from "./settings";
import { ensureOrderPaidState, findInFlightProviderPayment, findPendingManualPayment, isPayable, markPaid, recordOrderEvent, refundPayment } from "./service";

/**
 * Payme Merchant API (JSON-RPC 2.0). Hujjat: developer.help.paycom.uz
 * Barcha javoblar HTTP 200, xato JSON-RPC `error` ichida.
 * Summalar tiyinda (so'm × 100), vaqtlar — ms.
 * account.order_id "sub_…" bilan boshlansa — mutaxassis obunasi hisobi (subscription_invoices), aks holda eskrou buyurtmasi.
 * Ikkalasida ham bir xil semantika: 12 soat muddat, -31050/-31001/-31099/-31008/-31007, idempotentlik, holat -1/-2.
 */

/* ---------- Xato kodlari ---------- */
export const PAYME_ERR = {
  PARSE: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  AUTH: -32504,
  WRONG_AMOUNT: -31001,
  TXN_NOT_FOUND: -31003,
  CANNOT_PERFORM: -31008,
  CANNOT_CANCEL: -31007,
  ACCOUNT_NOT_FOUND: -31050,
  ORDER_BUSY: -31099,
} as const;

const MSG: Record<number, { uz: string; ru: string; en: string }> = {
  [-32700]: { uz: "JSON o'qib bo'lmadi", ru: "Ошибка разбора JSON", en: "Parse error" },
  [-32600]: { uz: "So'rov noto'g'ri", ru: "Неверный запрос", en: "Invalid request" },
  [-32601]: { uz: "Metod topilmadi", ru: "Метод не найден", en: "Method not found" },
  [-32504]: { uz: "Ruxsat yo'q", ru: "Недостаточно привилегий", en: "Insufficient privilege" },
  [-31001]: { uz: "Summa noto'g'ri", ru: "Неверная сумма", en: "Wrong amount" },
  [-31003]: { uz: "Tranzaksiya topilmadi", ru: "Транзакция не найдена", en: "Transaction not found" },
  [-31008]: { uz: "Amalni bajarib bo'lmaydi", ru: "Невозможно выполнить операцию", en: "Unable to perform operation" },
  [-31007]: { uz: "Tranzaksiyani bekor qilib bo'lmaydi", ru: "Невозможно отменить транзакцию", en: "Unable to cancel transaction" },
  [-31050]: { uz: "Buyurtma topilmadi yoki to'lovga tayyor emas", ru: "Заказ не найден или не готов к оплате", en: "Order not found or not payable" },
  [-31099]: { uz: "Buyurtma uchun boshqa tranzaksiya mavjud", ru: "По заказу уже есть активная транзакция", en: "Another transaction is active for this order" },
};

/** Payme holatlari */
const STATE = { CREATED: 1, PERFORMED: 2, CANCELLED: -1, CANCELLED_AFTER_PERFORM: -2 } as const;
/** Yaratilgan, lekin 12 soat ichida bajarilmagan tranzaksiya — bekor (sabab 4) */
export const PAYME_TIMEOUT_MS = 12 * 60 * 60 * 1000;

type Json = Record<string, unknown>;
type RpcId = string | number | null;

class RpcError extends Error {
  constructor(
    public code: number,
    public data?: string,
  ) {
    super(MSG[code]?.en ?? "Error");
  }
}

function rpcResult(id: RpcId, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id, result });
}
function rpcError(id: RpcId, code: number, data?: string) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message: MSG[code] ?? MSG[-32600], ...(data ? { data } : {}) } });
}

/* ---------- Auth: Basic Paycom:<KEY> ---------- */
function checkAuth(req: Request): boolean {
  const key = paymentsEnv().payme.key;
  if (!key) return false;
  const header = req.headers.get("authorization") ?? "";
  const m = /^Basic\s+(.+)$/i.exec(header.trim());
  if (!m) return false;
  let decoded = "";
  try {
    decoded = Buffer.from(m[1], "base64").toString("utf8");
  } catch {
    return false;
  }
  const idx = decoded.indexOf(":");
  if (idx < 0) return false;
  const login = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);
  return login === "Paycom" && safeEqual(pass, key);
}

/* ---------- Yordamchilar ---------- */
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : typeof v === "number" ? String(v) : null);

function accountOrderId(params: Json): string {
  const account = params.account as Json | undefined;
  const id = str(account?.order_id);
  if (!id) throw new RpcError(PAYME_ERR.ACCOUNT_NOT_FOUND, "order_id");
  return id;
}

/** account.order_id (xato tashlamaydi) — obuna hisobi / buyurtmani ajratish uchun */
function accountRef(params: Json): string | null {
  return str((params.account as Json | undefined)?.order_id);
}

async function loadOrder(orderId: string) {
  return db.query.orders.findFirst({ where: eq(orders.id, orderId) });
}

/** Buyurtma mavjud + to'lovga tayyor + summa mos. Tranzaksiya allaqachon mavjud bo'lsa `existing` bilan chaqiriladi. */
async function validateAccount(params: Json, existing?: Payment | null) {
  const orderId = accountOrderId(params);
  const order = await loadOrder(orderId);
  if (!order) throw new RpcError(PAYME_ERR.ACCOUNT_NOT_FOUND, "order_id");
  if (!existing) {
    // Avval buyurtma holati (narx yo'q / to'langan / bekor) — summa xatosi faqat narx bor-u, mos kelmaganda
    if (!isPayable(order)) throw new RpcError(PAYME_ERR.ACCOUNT_NOT_FOUND, "order_id");
    // Boshqa provayder (Click) tomonida jarayondagi tranzaksiya bo'lsa — ikkinchi to'lov ochilmaydi
    const inFlight = await findInFlightProviderPayment(order.id);
    if (inFlight && inFlight.provider !== "payme") throw new RpcError(PAYME_ERR.ORDER_BUSY, "order_id");
    // Admin tasdig'ini kutayotgan qo'lda o'tkazma ham jarayondagi to'lov — ikki marta to'lab qo'ymasin
    if (await findPendingManualPayment(order.id)) throw new RpcError(PAYME_ERR.ORDER_BUSY, "order_id");
  }
  const amount = num(params.amount);
  if (amount == null) throw new RpcError(PAYME_ERR.WRONG_AMOUNT, "amount");
  const expected = (existing?.amount ?? order.amount ?? 0) * 100;
  if (!expected || amount !== expected) throw new RpcError(PAYME_ERR.WRONG_AMOUNT, "amount");
  return order;
}

/** Payme'ga qaytariladigan holat: ichki holat ustun (ichkaridan bekor qilingan yozuv hech qachon 1 bo'lib ko'rinmasin) */
function providerStateOf(p: Payment): number {
  if (p.state === "cancelled") return p.providerState != null && p.providerState < 0 ? p.providerState : STATE.CANCELLED;
  if (p.state === "refunded") return STATE.CANCELLED_AFTER_PERFORM;
  if (p.state === "paid" || p.state === "released") return STATE.PERFORMED;
  return p.providerState ?? (p.state === "pending" ? STATE.CREATED : STATE.CANCELLED);
}

function txnView(p: Payment) {
  return {
    create_time: p.providerCreateTime ?? p.createdAt.getTime(),
    perform_time: p.performTime ?? 0,
    cancel_time: p.cancelTime ?? 0,
    transaction: p.id,
    state: providerStateOf(p),
    reason: p.cancelReason ?? null,
  };
}

async function findByTxnId(id: string) {
  return db.query.payments.findFirst({ where: and(eq(payments.provider, "payme"), eq(payments.providerTxnId, id)) });
}

/** Kutilayotgan tranzaksiya 12 soatdan oshgan bo'lsa — bekor (reason 4) qilib qaytaradi */
async function expireIfStale(p: Payment): Promise<Payment> {
  if (p.state !== "pending" || p.providerState !== STATE.CREATED) return p;
  const created = p.providerCreateTime ?? p.createdAt.getTime();
  if (Date.now() - created <= PAYME_TIMEOUT_MS) return p;
  const now = Date.now();
  // Holatga bog'liq: parallel Perform to'lab qo'ygan bo'lsa 'paid' yozuv ustidan yozilmaydi
  const [row] = await db
    .update(payments)
    .set({ state: "cancelled", providerState: STATE.CANCELLED, cancelTime: now, cancelReason: 4, updatedAt: new Date(now) })
    .where(and(eq(payments.id, p.id), eq(payments.state, "pending")))
    .returning();
  return row ?? (await db.query.payments.findFirst({ where: eq(payments.id, p.id) })) ?? p;
}

/* ---------- Metodlar ---------- */
async function checkPerformTransaction(params: Json) {
  const ref = accountRef(params);
  if (isInvoiceId(ref)) await validateInvoiceAccount(params, ref);
  else await validateAccount(params);
  return { allow: true };
}

async function createTransaction(params: Json) {
  const id = str(params.id);
  const time = num(params.time);
  if (!id || time == null) throw new RpcError(PAYME_ERR.INVALID_REQUEST);
  const ref = accountRef(params);
  if (isInvoiceId(ref)) return createInvoiceTransaction(params, ref, id, time);

  const found = await findByTxnId(id);
  if (found) {
    const p = await expireIfStale(found);
    if (p.state === "cancelled") throw new RpcError(PAYME_ERR.CANNOT_PERFORM);
    if (p.providerState !== STATE.CREATED) throw new RpcError(PAYME_ERR.CANNOT_PERFORM);
    return { create_time: p.providerCreateTime ?? p.createdAt.getTime(), transaction: p.id, state: STATE.CREATED };
  }

  const order = await validateAccount(params);

  // Shu buyurtma bo'yicha boshqa faol Payme tranzaksiyasi bormi?
  const active = await db.query.payments.findMany({
    where: and(eq(payments.orderId, order.id), eq(payments.provider, "payme"), inArray(payments.state, ["pending", "paid", "released"])),
  });
  for (const a of active) {
    const fresh = await expireIfStale(a);
    if (fresh.state !== "cancelled" && fresh.providerTxnId && fresh.providerTxnId !== id) throw new RpcError(PAYME_ERR.ORDER_BUSY, "order_id");
  }

  // Checkout orqali yaratilgan (hali provayderga bog'lanmagan) to'lov bo'lsa — unga bog'laymiz
  const draft = await db.query.payments.findFirst({ where: and(eq(payments.orderId, order.id), eq(payments.provider, "payme"), eq(payments.state, "created")) });
  const settings = await getSettings();
  const pct = order.commissionPct ?? settings.commissionPct;
  const { commissionAmount, netAmount } = splitAmount(order.amount!, pct);
  const now = new Date();

  let row: Payment;
  if (draft) {
    [row] = await db
      .update(payments)
      .set({ state: "pending", providerTxnId: id, providerState: STATE.CREATED, providerCreateTime: time, amount: order.amount!, commissionPct: pct, commissionAmount, netAmount, updatedAt: now })
      .where(eq(payments.id, draft.id))
      .returning();
  } else {
    [row] = await db
      .insert(payments)
      .values({
        id: uid(),
        orderId: order.id,
        clientId: order.clientId,
        specialistId: order.specialistId,
        amount: order.amount!,
        commissionPct: pct,
        commissionAmount,
        netAmount,
        provider: "payme",
        state: "pending",
        providerTxnId: id,
        providerState: STATE.CREATED,
        providerCreateTime: time,
        meta: {},
      })
      .returning();
  }
  return { create_time: row.providerCreateTime ?? now.getTime(), transaction: row.id, state: STATE.CREATED };
}

async function performTransaction(params: Json) {
  const id = str(params.id);
  if (!id) throw new RpcError(PAYME_ERR.INVALID_REQUEST);
  const found = await findByTxnId(id);
  if (!found) {
    const inv = await findInvoiceByTxnId(id);
    if (inv) return performInvoiceTransaction(inv);
    throw new RpcError(PAYME_ERR.TXN_NOT_FOUND);
  }

  if (found.providerState === STATE.PERFORMED || found.state === "paid" || found.state === "released") {
    // O'z-o'zini tuzatish: avvalgi Perform'da buyurtma yangilanishi o'tib ketgan bo'lsa — idempotent qayta bajariladi
    await ensureOrderPaidState(found);
    return { transaction: found.id, perform_time: found.performTime ?? found.paidAt?.getTime() ?? 0, state: STATE.PERFORMED };
  }
  const p = await expireIfStale(found);
  if (p.state !== "pending" || p.providerState !== STATE.CREATED) throw new RpcError(PAYME_ERR.CANNOT_PERFORM);

  const performTime = Date.now();
  const row = await markPaid(p.id, { providerState: STATE.PERFORMED, performTime });
  return { transaction: row.id, perform_time: row.performTime ?? performTime, state: STATE.PERFORMED };
}

async function cancelTransaction(params: Json) {
  const id = str(params.id);
  if (!id) throw new RpcError(PAYME_ERR.INVALID_REQUEST);
  const reason = num(params.reason);
  const found = await findByTxnId(id);
  if (!found) {
    const inv = await findInvoiceByTxnId(id);
    if (inv) return cancelInvoiceTransaction(inv, reason);
    throw new RpcError(PAYME_ERR.TXN_NOT_FOUND);
  }

  // Allaqachon bekor — o'sha holatni qaytaramiz
  if (found.state === "cancelled" || found.state === "refunded") {
    return { transaction: found.id, cancel_time: found.cancelTime ?? 0, state: providerStateOf(found) };
  }
  const now = Date.now();
  if (found.state === "pending" || found.state === "created") {
    // Holatga bog'liq: parallel Perform to'lab qo'ygan bo'lsa 'paid' yozuv bekor qilinmaydi
    const [row] = await db
      .update(payments)
      .set({ state: "cancelled", providerState: STATE.CANCELLED, cancelTime: now, cancelReason: reason, updatedAt: new Date(now) })
      .where(and(eq(payments.id, found.id), inArray(payments.state, ["created", "pending"])))
      .returning();
    if (!row) {
      // Parallel o'zgargan (masalan, shu payt bajarildi) — joriy holat bo'yicha qayta ko'rib chiqiladi
      const fresh = await db.query.payments.findFirst({ where: eq(payments.id, found.id) });
      if (!fresh || fresh.state === "pending" || fresh.state === "created") throw new RpcError(PAYME_ERR.CANNOT_CANCEL);
      return cancelTransaction(params);
    }
    await recordOrderEvent(row.orderId, null, "payment", { note: "Payme to'lovi bekor qilindi (provayder tomonida)" });
    return { transaction: row.id, cancel_time: now, state: STATE.CANCELLED };
  }
  if (found.state === "paid") {
    // Ish topshirilgan (buyurtma 'done') — avtomatik qaytarilmaydi: -31007, nizoni admin ko'rib chiqadi
    const order = await loadOrder(found.orderId);
    if (order?.status === "done") {
      await notifyAdmins(
        "refund_needed",
        "Payme qaytarish so'rovi — ish topshirilgan",
        `«${order.title}» (${formatPrice(found.amount)}) bo'yicha Payme tranzaksiyasini bekor qilish so'raldi, lekin mutaxassis ishni yakunlagan. Nizoni ko'rib chiqing.`,
        "/admin#tolovlar",
        { dedupeMs: 6 * 60 * 60 * 1000 },
      );
      throw new RpcError(PAYME_ERR.CANNOT_CANCEL);
    }
    // Pul hali eskrouda, ish topshirilmagan — qaytarish mumkin
    try {
      const row = await refundPayment(found.id, null, reason);
      return { transaction: row.id, cancel_time: row.cancelTime ?? now, state: STATE.CANCELLED_AFTER_PERFORM };
    } catch {
      // Parallel o'zgargan (masalan, released bo'ldi) — joriy holat bo'yicha javob, ustidan yozilmaydi
      const fresh = await db.query.payments.findFirst({ where: eq(payments.id, found.id) });
      if (fresh?.state === "refunded") return { transaction: fresh.id, cancel_time: fresh.cancelTime ?? 0, state: providerStateOf(fresh) };
      throw new RpcError(PAYME_ERR.CANNOT_CANCEL);
    }
  }
  // released — mutaxassisga o'tib bo'lgan
  throw new RpcError(PAYME_ERR.CANNOT_CANCEL);
}

async function checkTransaction(params: Json) {
  const id = str(params.id);
  if (!id) throw new RpcError(PAYME_ERR.INVALID_REQUEST);
  const found = await findByTxnId(id);
  if (!found) {
    const inv = await findInvoiceByTxnId(id);
    if (inv) return invoiceTxnView(await expireInvoiceIfStale(inv));
    throw new RpcError(PAYME_ERR.TXN_NOT_FOUND);
  }
  return txnView(await expireIfStale(found));
}

async function getStatement(params: Json) {
  const from = num(params.from) ?? 0;
  const to = num(params.to) ?? Date.now();
  const [rows, invoices] = await Promise.all([
    db.query.payments.findMany({
      where: and(eq(payments.provider, "payme"), gte(payments.providerCreateTime, from), lte(payments.providerCreateTime, to)),
    }),
    db.query.subscriptionInvoices.findMany({
      where: and(eq(subscriptionInvoices.provider, "payme"), gte(subscriptionInvoices.providerCreateTime, from), lte(subscriptionInvoices.providerCreateTime, to)),
    }),
  ]);
  const orderTxns = rows
    .filter((p) => p.providerTxnId)
    .map((p) => ({
      id: p.providerTxnId,
      time: p.providerCreateTime ?? p.createdAt.getTime(),
      amount: p.amount * 100,
      account: { order_id: p.orderId },
      ...txnView(p),
      receivers: null,
    }));
  const invoiceTxns = invoices
    .filter((i) => i.providerTxnId)
    .map((i) => ({
      id: i.providerTxnId,
      time: i.providerCreateTime ?? i.createdAt.getTime(),
      amount: i.amount * 100,
      account: { order_id: i.id },
      ...invoiceTxnView(i),
      receivers: null,
    }));
  return { transactions: [...orderTxns, ...invoiceTxns].sort((a, b) => a.time - b.time) };
}

/* ---------- Obuna hisoblari (account.order_id = "sub_…") ---------- */
async function findInvoiceByTxnId(id: string): Promise<SubscriptionInvoice | null> {
  return (await db.query.subscriptionInvoices.findFirst({ where: and(eq(subscriptionInvoices.provider, "payme"), eq(subscriptionInvoices.providerTxnId, id)) })) ?? null;
}

/** Payme'ga qaytariladigan holat (providerStateOf bilan bir xil qoida) */
function invoiceProviderStateOf(i: SubscriptionInvoice): number {
  if (i.state === "cancelled") return i.providerState != null && i.providerState < 0 ? i.providerState : STATE.CANCELLED;
  if (i.state === "refunded") return STATE.CANCELLED_AFTER_PERFORM;
  if (i.state === "paid") return STATE.PERFORMED;
  return i.providerState ?? (i.state === "pending" ? STATE.CREATED : STATE.CANCELLED);
}

function invoiceTxnView(i: SubscriptionInvoice) {
  return {
    create_time: i.providerCreateTime ?? i.createdAt.getTime(),
    perform_time: i.performTime ?? 0,
    cancel_time: i.cancelTime ?? 0,
    transaction: i.id,
    state: invoiceProviderStateOf(i),
    reason: i.cancelReason ?? null,
  };
}

/** 12 soatdan oshgan bajarilmagan tranzaksiya — hisob bekor (reason 4) */
async function expireInvoiceIfStale(i: SubscriptionInvoice): Promise<SubscriptionInvoice> {
  if (i.state !== "pending" || i.providerState !== STATE.CREATED) return i;
  const created = i.providerCreateTime ?? i.createdAt.getTime();
  if (Date.now() - created <= PAYME_TIMEOUT_MS) return i;
  const now = Date.now();
  const [row] = await db
    .update(subscriptionInvoices)
    .set({ state: "cancelled", providerState: STATE.CANCELLED, cancelTime: now, cancelReason: 4, updatedAt: new Date(now) })
    .where(and(eq(subscriptionInvoices.id, i.id), eq(subscriptionInvoices.state, "pending")))
    .returning();
  return row ?? (await loadInvoice(i.id)) ?? i;
}

/**
 * Hisob mavjud, Payme uchun ochilgan, to'lanmagan va summa mos. Yangi tranzaksiya uchun: 'created' yoki
 * jarayondagi 'pending' (CheckPerform ruxsat beradi, CreateTransaction boshqa id bilan -31099 qaytaradi).
 */
async function validateInvoiceAccount(params: Json, invoiceId: string, existing?: SubscriptionInvoice | null): Promise<SubscriptionInvoice> {
  let inv = await loadInvoice(invoiceId);
  if (!inv || (!inv.specialistId && !isPurchase(inv)) || inv.provider !== "payme") throw new RpcError(PAYME_ERR.ACCOUNT_NOT_FOUND, "order_id");
  if (!existing) {
    if (inv.state === "pending") inv = await expireInvoiceIfStale(inv);
    if (inv.state !== "created" && inv.state !== "pending") throw new RpcError(PAYME_ERR.ACCOUNT_NOT_FOUND, "order_id");
  }
  const amount = num(params.amount);
  if (amount == null) throw new RpcError(PAYME_ERR.WRONG_AMOUNT, "amount");
  const expected = (existing?.amount ?? inv.amount) * 100;
  if (!expected || amount !== expected) throw new RpcError(PAYME_ERR.WRONG_AMOUNT, "amount");
  return inv;
}

async function createInvoiceTransaction(params: Json, invoiceId: string, id: string, time: number) {
  const found = await findInvoiceByTxnId(id);
  if (found) {
    const inv = await expireInvoiceIfStale(found);
    if (inv.state === "cancelled" || inv.providerState !== STATE.CREATED) throw new RpcError(PAYME_ERR.CANNOT_PERFORM);
    return { create_time: inv.providerCreateTime ?? inv.createdAt.getTime(), transaction: inv.id, state: STATE.CREATED };
  }
  const inv = await validateInvoiceAccount(params, invoiceId);
  // Hisobga boshqa (hali eskirmagan) Payme tranzaksiyasi bog'langan
  if (inv.state === "pending") throw new RpcError(PAYME_ERR.ORDER_BUSY, "order_id");
  const [row] = await db
    .update(subscriptionInvoices)
    .set({ state: "pending", providerTxnId: id, providerState: STATE.CREATED, providerCreateTime: time, updatedAt: new Date() })
    .where(and(eq(subscriptionInvoices.id, inv.id), eq(subscriptionInvoices.state, "created")))
    .returning();
  if (!row) throw new RpcError(PAYME_ERR.ORDER_BUSY, "order_id");
  return { create_time: row.providerCreateTime ?? time, transaction: row.id, state: STATE.CREATED };
}

async function performInvoiceTransaction(found: SubscriptionInvoice) {
  if (found.state === "paid") {
    return { transaction: found.id, perform_time: found.performTime ?? found.paidAt?.getTime() ?? 0, state: STATE.PERFORMED };
  }
  const inv = await expireInvoiceIfStale(found);
  if (inv.state !== "pending" || inv.providerState !== STATE.CREATED) throw new RpcError(PAYME_ERR.CANNOT_PERFORM);
  const performTime = Date.now();
  const row = await markInvoicePaid(inv.id, { providerState: STATE.PERFORMED, performTime });
  return { transaction: row.id, perform_time: row.performTime ?? performTime, state: STATE.PERFORMED };
}

async function cancelInvoiceTransaction(found: SubscriptionInvoice, reason: number | null) {
  if (found.state === "cancelled" || found.state === "refunded") {
    return { transaction: found.id, cancel_time: found.cancelTime ?? 0, state: invoiceProviderStateOf(found) };
  }
  if (found.state === "pending" || found.state === "created") {
    const now = Date.now();
    const [row] = await db
      .update(subscriptionInvoices)
      .set({ state: "cancelled", providerState: STATE.CANCELLED, cancelTime: now, cancelReason: reason, updatedAt: new Date(now) })
      .where(and(eq(subscriptionInvoices.id, found.id), eq(subscriptionInvoices.state, found.state)))
      .returning();
    if (row) return { transaction: row.id, cancel_time: now, state: STATE.CANCELLED };
    // Parallel o'zgargan (masalan, shu payt bajarildi) — yangi holat bo'yicha qayta
    const fresh = await loadInvoice(found.id);
    if (!fresh || fresh.state === "pending" || fresh.state === "created") throw new RpcError(PAYME_ERR.CANNOT_CANCEL);
    return cancelInvoiceTransaction(fresh, reason);
  }
  // paid: obuna to'lovini qaytarish — muddat shu davrga qisqaradi (refundInvoice), holat -2
  const row = await refundInvoice(found.id, null, { reason });
  return { transaction: row.id, cancel_time: row.cancelTime ?? Date.now(), state: STATE.CANCELLED_AFTER_PERFORM };
}

/* ---------- Kirish nuqtasi ---------- */
export async function handlePayme(req: Request): Promise<Response> {
  let body: Json;
  try {
    body = (await req.json()) as Json;
  } catch {
    return rpcError(null, PAYME_ERR.PARSE);
  }
  const id = (typeof body?.id === "number" || typeof body?.id === "string" ? body.id : null) as RpcId;

  if (!checkAuth(req)) return rpcError(id, PAYME_ERR.AUTH);

  const method = typeof body?.method === "string" ? body.method : null;
  const params = (body?.params && typeof body.params === "object" ? body.params : {}) as Json;
  if (!method) return rpcError(id, PAYME_ERR.INVALID_REQUEST);

  try {
    switch (method) {
      case "CheckPerformTransaction":
        return rpcResult(id, await checkPerformTransaction(params));
      case "CreateTransaction":
        return rpcResult(id, await createTransaction(params));
      case "PerformTransaction":
        return rpcResult(id, await performTransaction(params));
      case "CancelTransaction":
        return rpcResult(id, await cancelTransaction(params));
      case "CheckTransaction":
        return rpcResult(id, await checkTransaction(params));
      case "GetStatement":
        return rpcResult(id, await getStatement(params));
      default:
        return rpcError(id, PAYME_ERR.METHOD_NOT_FOUND);
    }
  } catch (e) {
    if (e instanceof RpcError) return rpcError(id, e.code, e.data);
    console.error("[payme]", method, e);
    return rpcError(id, PAYME_ERR.CANNOT_PERFORM);
  }
}
