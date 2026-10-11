import "server-only";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orders, payments, type Payment } from "@/lib/db/schema";
import { uid } from "@/lib/utils";
import { paymentsEnv, safeEqual } from "./config";
import { getSettings, splitAmount } from "./settings";
import { findInFlightProviderPayment, isPayable, markPaid } from "./service";

/**
 * Click SHOP API (Prepare / Complete). Hujjat: docs.click.uz/click-api-request
 * So'rov: application/x-www-form-urlencoded. Javob: JSON.
 *  Prepare  (action=0): sign = md5(click_trans_id + service_id + SECRET + merchant_trans_id + amount + action + sign_time)
 *  Complete (action=1): sign = md5(click_trans_id + service_id + SECRET + merchant_trans_id + merchant_prepare_id + amount + action + sign_time)
 */
export const CLICK_ERR = {
  SUCCESS: 0,
  SIGN: -1,
  AMOUNT: -2,
  ACTION: -3,
  ALREADY_PAID: -4,
  USER_NOT_FOUND: -5,
  TXN_NOT_FOUND: -6,
  UPDATE_FAILED: -7,
  BAD_REQUEST: -8,
  CANCELLED: -9,
} as const;

const NOTE: Record<number, string> = {
  0: "Success",
  [-1]: "SIGN CHECK FAILED!",
  [-2]: "Incorrect parameter amount",
  [-3]: "Action not found",
  [-4]: "Already paid",
  [-5]: "Order does not exist",
  [-6]: "Transaction does not exist",
  [-7]: "Failed to update order",
  [-8]: "Error in request from click",
  [-9]: "Transaction cancelled",
};

export function md5(s: string) {
  return createHash("md5").update(s, "utf8").digest("hex");
}

type Fields = Record<string, string>;

function respond(fields: Fields, error: number, extra: Record<string, unknown> = {}) {
  return Response.json({
    click_trans_id: Number(fields.click_trans_id) || fields.click_trans_id || null,
    merchant_trans_id: fields.merchant_trans_id ?? null,
    ...extra,
    error,
    error_note: NOTE[error] ?? "Error",
  });
}

async function parseFields(req: Request): Promise<Fields> {
  const ct = req.headers.get("content-type") ?? "";
  const out: Fields = {};
  if (ct.includes("application/json")) {
    const j = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    for (const [k, v] of Object.entries(j)) if (v != null) out[k] = String(v);
    return out;
  }
  const text = await req.text();
  for (const [k, v] of new URLSearchParams(text)) out[k] = v;
  return out;
}

function amountMatches(raw: string, expected: number): boolean {
  const n = Number(raw);
  return Number.isFinite(n) && Math.abs(n - expected) < 0.01;
}

async function findByClickId(clickTransId: string) {
  return db.query.payments.findFirst({ where: and(eq(payments.provider, "click"), eq(payments.providerTxnId, clickTransId)) });
}

/* ---------- Prepare ---------- */
async function prepare(f: Fields, secret: string) {
  const sign = md5(f.click_trans_id + f.service_id + secret + f.merchant_trans_id + f.amount + f.action + f.sign_time);
  if (!safeEqual(sign, (f.sign_string ?? "").toLowerCase())) return respond(f, CLICK_ERR.SIGN);

  const order = await db.query.orders.findFirst({ where: eq(orders.id, f.merchant_trans_id) });
  if (!order) return respond(f, CLICK_ERR.USER_NOT_FOUND);

  // Qayta Prepare (takroriy so'rov) — mavjud tranzaksiyani qaytaramiz
  const existing = await findByClickId(f.click_trans_id);
  if (existing) {
    if (existing.state === "paid" || existing.state === "released") return respond(f, CLICK_ERR.ALREADY_PAID);
    if (existing.state === "cancelled" || existing.state === "refunded") return respond(f, CLICK_ERR.CANCELLED);
    if (!amountMatches(f.amount, existing.amount)) return respond(f, CLICK_ERR.AMOUNT);
    return respond(f, CLICK_ERR.SUCCESS, { merchant_prepare_id: Number(existing.meta.prepareId ?? 0) });
  }

  if (order.paymentState === "paid" || order.paymentState === "released") return respond(f, CLICK_ERR.ALREADY_PAID);
  if (!isPayable(order) || !order.amount) return respond(f, CLICK_ERR.USER_NOT_FOUND);
  // Boshqa provayder (Payme) tomonida jarayondagi tranzaksiya bo'lsa — buyurtma hozircha to'lovga yopiq
  const inFlight = await findInFlightProviderPayment(order.id);
  if (inFlight && inFlight.provider !== "click") return respond(f, CLICK_ERR.USER_NOT_FOUND);
  if (!amountMatches(f.amount, order.amount)) return respond(f, CLICK_ERR.AMOUNT);

  const settings = await getSettings();
  const pct = order.commissionPct ?? settings.commissionPct;
  const { commissionAmount, netAmount } = splitAmount(order.amount, pct);
  const prepareId = Date.now();
  const now = new Date();
  const meta = { prepareId, clickPaydocId: f.click_paydoc_id ?? null, signTime: f.sign_time ?? null };

  const draft = await db.query.payments.findFirst({ where: and(eq(payments.orderId, order.id), eq(payments.provider, "click"), eq(payments.state, "created")) });
  let row: Payment;
  if (draft) {
    [row] = await db
      .update(payments)
      .set({ state: "pending", providerTxnId: f.click_trans_id, providerState: 1, providerCreateTime: prepareId, amount: order.amount, commissionPct: pct, commissionAmount, netAmount, meta: { ...draft.meta, ...meta }, updatedAt: now })
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
        amount: order.amount,
        commissionPct: pct,
        commissionAmount,
        netAmount,
        provider: "click",
        state: "pending",
        providerTxnId: f.click_trans_id,
        providerState: 1,
        providerCreateTime: prepareId,
        meta,
      })
      .returning();
  }
  return respond(f, CLICK_ERR.SUCCESS, { merchant_prepare_id: Number(row.meta.prepareId ?? prepareId) });
}

/* ---------- Complete ---------- */
async function complete(f: Fields, secret: string) {
  const sign = md5(f.click_trans_id + f.service_id + secret + f.merchant_trans_id + f.merchant_prepare_id + f.amount + f.action + f.sign_time);
  if (!safeEqual(sign, (f.sign_string ?? "").toLowerCase())) return respond(f, CLICK_ERR.SIGN);

  const order = await db.query.orders.findFirst({ where: eq(orders.id, f.merchant_trans_id) });
  if (!order) return respond(f, CLICK_ERR.USER_NOT_FOUND);

  const payment = await findByClickId(f.click_trans_id);
  if (!payment || String(payment.meta.prepareId ?? "") !== String(f.merchant_prepare_id)) return respond(f, CLICK_ERR.TXN_NOT_FOUND);
  if (!amountMatches(f.amount, payment.amount)) return respond(f, CLICK_ERR.AMOUNT);

  const confirmId = Number(payment.meta.prepareId);

  // Click tomonida xato (error < 0) — bekor
  const clickError = Number(f.error ?? 0);
  if (clickError < 0) {
    if (payment.state === "pending" || payment.state === "created") {
      const now = Date.now();
      await db
        .update(payments)
        .set({ state: "cancelled", providerState: -1, cancelTime: now, cancelReason: clickError, updatedAt: new Date(now) })
        .where(eq(payments.id, payment.id));
    }
    return respond(f, CLICK_ERR.CANCELLED, { merchant_confirm_id: confirmId });
  }

  if (payment.state === "paid" || payment.state === "released") return respond(f, CLICK_ERR.SUCCESS, { merchant_confirm_id: confirmId });
  if (payment.state === "cancelled" || payment.state === "refunded") return respond(f, CLICK_ERR.CANCELLED, { merchant_confirm_id: confirmId });

  try {
    await markPaid(payment.id, { providerState: 2, performTime: Date.now() });
  } catch (e) {
    console.error("[click] complete", e);
    return respond(f, CLICK_ERR.UPDATE_FAILED, { merchant_confirm_id: confirmId });
  }
  return respond(f, CLICK_ERR.SUCCESS, { merchant_confirm_id: confirmId });
}

/* ---------- Kirish nuqtasi ---------- */
export async function handleClick(req: Request): Promise<Response> {
  const env = paymentsEnv().click;
  const f = await parseFields(req);
  const required = ["click_trans_id", "service_id", "merchant_trans_id", "amount", "action", "sign_time", "sign_string"];
  if (required.some((k) => !f[k])) return respond(f, CLICK_ERR.BAD_REQUEST);
  if (!env.secret || (env.serviceId && f.service_id !== env.serviceId)) return respond(f, CLICK_ERR.SIGN);

  switch (f.action) {
    case "0":
      return prepare(f, env.secret);
    case "1":
      if (!f.merchant_prepare_id) return respond(f, CLICK_ERR.BAD_REQUEST);
      return complete(f, env.secret);
    default:
      return respond(f, CLICK_ERR.ACTION);
  }
}
