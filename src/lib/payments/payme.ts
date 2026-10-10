import "server-only";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, payments, type Payment } from "@/lib/db/schema";
import { uid } from "@/lib/utils";
import { paymentsEnv, safeEqual } from "./config";
import { getSettings, splitAmount } from "./settings";
import { isPayable, markPaid, refundPayment } from "./service";

/**
 * Payme Merchant API (JSON-RPC 2.0). Hujjat: developer.help.paycom.uz
 * Barcha javoblar HTTP 200, xato JSON-RPC `error` ichida.
 * Summalar tiyinda (so'm × 100), vaqtlar — ms.
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

async function loadOrder(orderId: string) {
  return db.query.orders.findFirst({ where: eq(orders.id, orderId) });
}

/** Buyurtma mavjud + to'lovga tayyor + summa mos. Tranzaksiya allaqachon mavjud bo'lsa `existing` bilan chaqiriladi. */
async function validateAccount(params: Json, existing?: Payment | null) {
  const orderId = accountOrderId(params);
  const order = await loadOrder(orderId);
  if (!order) throw new RpcError(PAYME_ERR.ACCOUNT_NOT_FOUND, "order_id");
  const amount = num(params.amount);
  if (amount == null) throw new RpcError(PAYME_ERR.WRONG_AMOUNT, "amount");
  const expected = (existing?.amount ?? order.amount ?? 0) * 100;
  if (!expected || amount !== expected) throw new RpcError(PAYME_ERR.WRONG_AMOUNT, "amount");
  if (!existing && !isPayable(order)) throw new RpcError(PAYME_ERR.ACCOUNT_NOT_FOUND, "order_id");
  return order;
}

function txnView(p: Payment) {
  return {
    create_time: p.providerCreateTime ?? p.createdAt.getTime(),
    perform_time: p.performTime ?? 0,
    cancel_time: p.cancelTime ?? 0,
    transaction: p.id,
    state: p.providerState ?? (p.state === "paid" || p.state === "released" ? STATE.PERFORMED : p.state === "pending" ? STATE.CREATED : STATE.CANCELLED),
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
  const [row] = await db
    .update(payments)
    .set({ state: "cancelled", providerState: STATE.CANCELLED, cancelTime: now, cancelReason: 4, updatedAt: new Date(now) })
    .where(eq(payments.id, p.id))
    .returning();
  return row;
}

/* ---------- Metodlar ---------- */
async function checkPerformTransaction(params: Json) {
  await validateAccount(params);
  return { allow: true };
}

async function createTransaction(params: Json) {
  const id = str(params.id);
  const time = num(params.time);
  if (!id || time == null) throw new RpcError(PAYME_ERR.INVALID_REQUEST);

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
  if (!found) throw new RpcError(PAYME_ERR.TXN_NOT_FOUND);

  if (found.providerState === STATE.PERFORMED || found.state === "paid" || found.state === "released") {
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
  if (!found) throw new RpcError(PAYME_ERR.TXN_NOT_FOUND);

  // Allaqachon bekor — o'sha holatni qaytaramiz
  if (found.state === "cancelled" || found.state === "refunded") {
    return { transaction: found.id, cancel_time: found.cancelTime ?? 0, state: found.providerState ?? STATE.CANCELLED };
  }
  const now = Date.now();
  if (found.state === "pending") {
    const [row] = await db
      .update(payments)
      .set({ state: "cancelled", providerState: STATE.CANCELLED, cancelTime: now, cancelReason: reason, updatedAt: new Date(now) })
      .where(eq(payments.id, found.id))
      .returning();
    return { transaction: row.id, cancel_time: now, state: STATE.CANCELLED };
  }
  if (found.state === "paid") {
    // Pul hali eskrouda — qaytarish mumkin
    const row = await refundPayment(found.id, null, reason);
    return { transaction: row.id, cancel_time: row.cancelTime ?? now, state: STATE.CANCELLED_AFTER_PERFORM };
  }
  // released — mutaxassisga o'tib bo'lgan
  throw new RpcError(PAYME_ERR.CANNOT_CANCEL);
}

async function checkTransaction(params: Json) {
  const id = str(params.id);
  if (!id) throw new RpcError(PAYME_ERR.INVALID_REQUEST);
  const found = await findByTxnId(id);
  if (!found) throw new RpcError(PAYME_ERR.TXN_NOT_FOUND);
  return txnView(await expireIfStale(found));
}

async function getStatement(params: Json) {
  const from = num(params.from) ?? 0;
  const to = num(params.to) ?? Date.now();
  const rows = await db.query.payments.findMany({
    where: and(eq(payments.provider, "payme"), gte(payments.providerCreateTime, from), lte(payments.providerCreateTime, to)),
  });
  return {
    transactions: rows
      .filter((p) => p.providerTxnId)
      .map((p) => ({
        id: p.providerTxnId,
        time: p.providerCreateTime ?? p.createdAt.getTime(),
        amount: p.amount * 100,
        account: { order_id: p.orderId },
        ...txnView(p),
        receivers: null,
      })),
  };
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
