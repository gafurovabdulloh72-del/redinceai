import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { platformSettings, subscriptionInvoices, type SubscriptionInvoice } from "@/lib/db/schema";
import { secretEquals } from "@/lib/security/secret-box";

/**
 * KARTAGA O'TKAZMANI AVTOMATIK TASDIQLASH (2026-11-23, YaTT/MChJ'siz yo'l).
 *
 * G'oya: qo'lda o'tkazma hisobiga NOYOB «to'lov summasi» beriladi (narx + 1…999 so'm, masalan 49 017). Admin telefoniga
 * bank SMS'i keladi → iPhone Shortcuts / Android SMS-forwarder SMS matnini `POST /api/tolov/sms`ga yuboradi (maxfiy kalit
 * bilan) → server matndan KIRIM summasini ajratadi va FAQAT shu summaga aynan teng bo'lgan ochiq hisob bo'lsa uni to'langan
 * qiladi. Boshqa har qanday tushum/chiqim (katta summalar, shaxsiy o'tkazmalar) E'TIBORSIZ qoldiriladi va matni HECH
 * QAYERGA yozilmaydi — faqat mos kelganlari auditda (summa + hisob raqami).
 *
 * Hisobdagi `amount` (buxgalteriya, ustoz ulushi) O'ZGARMAYDI — noyob qo'shimcha `meta.payAmount`da (≤999 so'm platformaga).
 */

const ENABLED_KEY = "smsAutoEnabled";
const HASH_KEY = "smsAutoKeyHash";
/** Noyob summa shu muddat ichida band hisoblanadi — undan eski hisob SMS bilan tasdiqlanmaydi */
export const SMS_MATCH_WINDOW_MS = 72 * 3_600_000;
const OPEN = ["created", "pending"] as const;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

async function readSetting(key: string): Promise<unknown> {
  const row = await db.query.platformSettings.findFirst({ where: eq(platformSettings.key, key) });
  return row?.value;
}
async function writeSetting(key: string, value: unknown): Promise<void> {
  await db
    .insert(platformSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedAt: new Date() } });
}

export async function smsAutoState(): Promise<{ enabled: boolean; hasKey: boolean }> {
  const [enabled, hash] = await Promise.all([readSetting(ENABLED_KEY), readSetting(HASH_KEY)]);
  return { enabled: enabled === 1 || enabled === true, hasKey: typeof hash === "string" && hash.length === 64 };
}

/** Yoqilgan VA kalit bor — noyob summa faqat shunda beriladi (aks holda mijoz ortiqcha so'mni bekorga to'laydi) */
export async function smsAutoActive(): Promise<boolean> {
  const s = await smsAutoState();
  return s.enabled && s.hasKey;
}

export async function setSmsAutoEnabled(on: boolean): Promise<void> {
  await writeSetting(ENABLED_KEY, on ? 1 : 0);
}

/** Yangi kalit: bazada faqat xeshi saqlanadi, ochiq qiymat adminga BIR MARTA ko'rsatiladi */
export async function rotateSmsKey(): Promise<string> {
  const key = randomBytes(24).toString("base64url");
  await writeSetting(HASH_KEY, sha(key));
  return key;
}

export async function verifySmsKey(key: string | null | undefined): Promise<boolean> {
  if (!key || key.length < 16 || key.length > 200) return false;
  const hash = await readSetting(HASH_KEY);
  return typeof hash === "string" && hash.length === 64 && secretEquals(hash, sha(key));
}

const payAmountOf = (i: Pick<SubscriptionInvoice, "meta">): number | null => {
  const v = (i.meta as { payAmount?: unknown } | null)?.payAmount;
  return typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null;
};

/**
 * Ochiq qo'lda o'tkazma hisobining to'lov summasi. Avtomatik tasdiqlash yoqilgan bo'lsa — noyob (narx + 1…999), birinchi
 * so'ralganda beriladi va hisob meta'siga yoziladi; o'chiq bo'lsa — oddiy narx.
 */
export async function ensurePayAmount(inv: SubscriptionInvoice): Promise<number> {
  const existing = payAmountOf(inv);
  if (existing) return existing;
  if (inv.provider !== "manual" || !(OPEN as readonly string[]).includes(inv.state) || inv.amount <= 0) return inv.amount;
  if (!(await smsAutoActive())) return inv.amount;
  const busy = await db
    .select({ meta: subscriptionInvoices.meta })
    .from(subscriptionInvoices)
    .where(and(eq(subscriptionInvoices.provider, "manual"), inArray(subscriptionInvoices.state, [...OPEN]), gte(subscriptionInvoices.createdAt, new Date(Date.now() - SMS_MATCH_WINDOW_MS))));
  const taken = new Set(busy.map((r) => payAmountOf(r)).filter((n): n is number => n !== null));
  let pay = 0;
  for (let i = 0; i < 60 && !pay; i++) {
    const cand = inv.amount + 1 + (randomBytes(2).readUInt16BE(0) % 999);
    if (!taken.has(cand)) pay = cand;
  }
  if (!pay) return inv.amount; // juda ko'p ochiq hisob — oddiy narx (qo'lda tasdiq)
  // CAS: boshqa so'rov allaqachon yozgan bo'lsa — o'shanisini olamiz
  const [row] = await db
    .update(subscriptionInvoices)
    .set({ meta: { ...(inv.meta ?? {}), payAmount: pay }, updatedAt: new Date() })
    .where(and(eq(subscriptionInvoices.id, inv.id), eq(subscriptionInvoices.updatedAt, inv.updatedAt)))
    .returning();
  if (row) return pay;
  const fresh = await db.query.subscriptionInvoices.findFirst({ where: eq(subscriptionInvoices.id, inv.id) });
  return (fresh && payAmountOf(fresh)) ?? inv.amount;
}

export async function payAmountFor(invoiceId: string): Promise<number | null> {
  const inv = await db.query.subscriptionInvoices.findFirst({ where: eq(subscriptionInvoices.id, invoiceId) });
  return inv ? ensurePayAmount(inv) : null;
}

/* ------------------------------------------------------------------ */
/* SMS tahlili                                                          */
/* ------------------------------------------------------------------ */
const CREDIT_RE = /(popolnen|пополнен|zachislen|зачислен|postuplen|поступлен|kirim|tushdi|tushum|qabul qilindi|o['ʻ’`]?tkazma keldi|perevod na kart|перевод на карт|credit|received|\bp2p\b.*(?:kirim|in\b)|\+\s?\d)/i;
const DEBIT_RE = /(spisan|списан|oplata|оплата|pokupka|покупка|yechildi|chiqim|xarid|snyat|снят|debit|purchase|payment)/i;
const BALANCE_RE = /(balans|баланс|balance|ostatok|остаток|qoldiq|dostupno|доступно|available|limit)\s*[:=]?\s*$/i;
const AMOUNT_RE = /(\+\s?)?(\d{1,3}(?:[   ,.]\d{3})+|\d{1,9})(?:[.,](\d{1,2}))?\s*(uzs|so['ʻ’`]?m|сум|sum\b)?/gi;

/**
 * Matndan KIRIM summalarini (butun so'm) ajratadi. Chiqim/xarid SMS'i, qoldiq (balans) summasi va tiyinli summalar
 * hisobga olinmaydi. Natija — nomzodlar; hisob bilan aynan mos kelmasa hech narsa qilinmaydi.
 */
export function parseCreditAmounts(text: string): number[] {
  const t = text.slice(0, 1000);
  if (!CREDIT_RE.test(t)) return [];
  if (DEBIT_RE.test(t) && !/(popolnen|пополнен|zachislen|зачислен|postuplen|поступлен|kirim|tushdi|credit|received)/i.test(t)) return [];
  const out = new Set<number>();
  for (const m of t.matchAll(AMOUNT_RE)) {
    const [, plus, int, frac, cur] = m;
    if (!plus && !cur) continue; // valyuta yoki «+» belgisi yo'q son — karta raqami, sana, vaqt bo'lishi mumkin
    const before = t.slice(Math.max(0, (m.index ?? 0) - 30), m.index ?? 0);
    if (BALANCE_RE.test(before)) continue;
    if (frac && Number(frac) !== 0) continue;
    const n = Number(int.replace(/[   ,.]/g, ""));
    if (Number.isSafeInteger(n) && n >= 1000 && n <= 100_000_000) out.add(n);
  }
  return [...out];
}

export type SmsMatch = { status: "matched"; invoiceId: string; amount: number } | { status: "ignored" } | { status: "ambiguous"; amount: number };

/** Kirim summasiga AYNAN teng noyob summali ochiq hisobni topadi (72 soat ichida yaratilgan) */
export async function matchSmsAmounts(amounts: number[]): Promise<SmsMatch> {
  if (!amounts.length) return { status: "ignored" };
  const rows = await db.query.subscriptionInvoices.findMany({
    where: and(eq(subscriptionInvoices.provider, "manual"), inArray(subscriptionInvoices.state, [...OPEN]), gte(subscriptionInvoices.createdAt, new Date(Date.now() - SMS_MATCH_WINDOW_MS))),
    columns: { id: true, meta: true },
  });
  for (const amount of amounts) {
    const hits = rows.filter((r) => payAmountOf(r) === amount);
    if (hits.length === 1) return { status: "matched", invoiceId: hits[0].id, amount };
    if (hits.length > 1) return { status: "ambiguous", amount };
  }
  return { status: "ignored" };
}
