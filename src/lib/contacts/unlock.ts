import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { contactUnlocks, specialists, subscriptionInvoices, users, type SubscriptionInvoice } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { getSettings, type PlatformSettings } from "@/lib/payments/settings";
import { isProviderConfigured } from "@/lib/payments/config";
import { notify } from "@/lib/notifications";
import type { PaymentProvider } from "@/lib/constants";
import { uid, formatPrice } from "@/lib/utils";

/**
 * KONTAKTNI OCHISH (2026-10-31): platforma mutaxassislarni «sotadi» — kontakt (telefon/Telegram/Instagram/email)
 * hech kimga bepul ko'rinmaydi; mijoz (yoki boshqa mutaxassis) ishlarini ko'rib, kontakt uchun PLATFORMAGA to'laydi.
 * Narx: tajriba darajasi bo'yicha umumiy (platform_settings contactPrice*) yoki mutaxassisga maxsus (specialists.contactPrice).
 * `specialists.contactMode = "hidden"` — faqat portfolio, sotilmaydi (eski xulq).
 *
 * Pul oqimi MAVJUD hisob tizimida: subscription_invoices, `meta.kind = "contact"` — Payme/Click webhook'lari, qo'lda
 * o'tkazma (chek, admin tasdig'i, Telegram tugmalari) o'zgarishsiz. To'langanda `fulfillContactUnlock`, qaytarilganda
 * `revokeContactUnlock` (billing.ts dispatch). Buyurtma/eskrou tizimi (eski) saqlangan — bu unga qo'shimcha.
 */
export type ContactMeta = { kind: "contact"; specialistId: string; title: string; base: number };

export const isContactUnlock = (i: Pick<SubscriptionInvoice, "meta">): boolean => (i.meta as { kind?: string } | null)?.kind === "contact";
export const contactMeta = (i: Pick<SubscriptionInvoice, "meta">) => i.meta as unknown as ContactMeta;
export const contactHref = (id: string) => `/kontakt/tolov/${encodeURIComponent(id)}`;

const PRICE_KEY: Record<string, keyof PlatformSettings> = { junior: "contactPriceJunior", middle: "contactPriceMiddle", senior: "contactPriceSenior", expert: "contactPriceExpert" };

/** Mutaxassis kontakti narxi (so'm): maxsus narx ustun, aks holda daraja bo'yicha */
export function contactPriceFor(sp: { experience: string; contactPrice: number | null }, settings: PlatformSettings): number {
  if (sp.contactPrice != null && sp.contactPrice >= 0) return sp.contactPrice;
  return settings[PRICE_KEY[sp.experience] ?? "contactPriceMiddle"];
}

/** Ko'ruvchi shu mutaxassis kontaktini ochganmi (to'langan) */
export async function hasContactUnlock(viewerId: string | null | undefined, specialistId: string): Promise<boolean> {
  if (!viewerId) return false;
  const row = await db.query.contactUnlocks.findFirst({ where: and(eq(contactUnlocks.clientId, viewerId), eq(contactUnlocks.specialistId, specialistId), eq(contactUnlocks.status, "paid")), columns: { id: true } });
  return Boolean(row);
}

export interface ContactQuote {
  specialistId: string;
  title: string;
  amount: number;
  mode: "paid" | "hidden";
  unlocked: boolean;
}

/** Narx va holat (profil sahifasi, xarid oynasi) */
export async function quoteContact(specialistId: string, buyerId: string): Promise<ContactQuote> {
  const sp = await db.query.specialists.findFirst({ where: eq(specialists.id, specialistId), columns: { id: true, userId: true, experience: true, contactPrice: true, contactMode: true, isHidden: true }, with: { user: { columns: { name: true, isBanned: true } } } });
  if (!sp || sp.isHidden || sp.user.isBanned) throw new ApiError(404, "Mutaxassis topilmadi");
  if (sp.userId === buyerId) throw new ApiError(400, "Bu sizning o'z profilingiz");
  if (sp.contactMode !== "paid") throw new ApiError(403, "Bu mutaxassisning kontakti sotilmaydi");
  const settings = await getSettings();
  return { specialistId: sp.id, title: `Kontakt — ${sp.user.name}`, amount: contactPriceFor(sp, settings), mode: sp.contactMode, unlocked: await hasContactUnlock(buyerId, sp.id) };
}

/** Xaridni boshlash: hisob ochiladi (narx 0 bo'lsa darhol ochiladi) */
export async function startContactUnlock(buyer: { id: string }, specialistId: string, provider: PaymentProvider): Promise<{ free: true } | { free: false; invoice: SubscriptionInvoice }> {
  const q = await quoteContact(specialistId, buyer.id);
  if (q.unlocked) throw new ApiError(409, "Kontakt allaqachon ochilgan");
  if (q.amount <= 0) {
    await db.transaction(async (tx) => grant(tx, buyer.id, specialistId, null, 0));
    await afterContactPaid(buyer.id, specialistId, 0, null);
    return { free: true };
  }
  if (q.amount < 1000) throw new ApiError(422, "Summa juda kichik");
  if (!(await isProviderConfigured(provider))) throw new ApiError(400, "Bu to'lov usuli hozircha ulanmagan");
  // Shu mutaxassis uchun ochiq (hali yuborilmagan) eski hisob bo'lsa yopamiz — ikkita hisob qolmasin
  const stale = await db.query.subscriptionInvoices.findMany({
    where: and(eq(subscriptionInvoices.userId, buyer.id), eq(subscriptionInvoices.state, "created"), sql`json_extract(${subscriptionInvoices.meta}, '$.kind') = 'contact'`, sql`json_extract(${subscriptionInvoices.meta}, '$.specialistId') = ${specialistId}`),
    columns: { id: true },
  });
  if (stale.length) await db.update(subscriptionInvoices).set({ state: "cancelled", providerState: -1, cancelTime: Date.now(), cancelReason: 4, updatedAt: new Date() }).where(inArray(subscriptionInvoices.id, stale.map((s) => s.id)));
  const meta: ContactMeta = { kind: "contact", specialistId, title: q.title, base: q.amount };
  const [invoice] = await db
    .insert(subscriptionInvoices)
    .values({ id: `sub_${crypto.randomUUID()}`, specialistId: null, userId: buyer.id, months: 0, amount: q.amount, provider, state: "created", meta: meta as unknown as Record<string, unknown> })
    .returning();
  return { free: false, invoice };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function grant(tx: Tx, clientId: string, specialistId: string, invoiceId: string | null, amount: number): Promise<void> {
  const now = new Date();
  await tx
    .insert(contactUnlocks)
    .values({ id: uid(), clientId, specialistId, invoiceId, amount, status: "paid", paidAt: now })
    .onConflictDoUpdate({ target: [contactUnlocks.clientId, contactUnlocks.specialistId], set: { invoiceId, amount, status: "paid", paidAt: now } });
}

/** markInvoicePaid tranzaksiyasi ichida */
export async function fulfillContactUnlock(tx: Tx, inv: SubscriptionInvoice): Promise<void> {
  const m = contactMeta(inv);
  if (!inv.userId) return;
  await grant(tx, inv.userId, m.specialistId, inv.id, inv.amount);
}

/** refundInvoice tranzaksiyasi ichida — kontakt yopiladi */
export async function revokeContactUnlock(tx: Tx, inv: SubscriptionInvoice): Promise<void> {
  const m = contactMeta(inv);
  if (!inv.userId) return;
  await tx.update(contactUnlocks).set({ status: "refunded" }).where(and(eq(contactUnlocks.clientId, inv.userId), eq(contactUnlocks.specialistId, m.specialistId)));
}

/** To'lovdan keyin (tranzaksiyadan tashqarida): mijozga — kontakt ochildi; mutaxassisga — kontaktingiz sotib olindi */
export async function afterContactPaid(buyerId: string, specialistId: string, amount: number, invoiceId: string | null): Promise<void> {
  const sp = await db.query.specialists.findFirst({ where: eq(specialists.id, specialistId), columns: { slug: true, userId: true }, with: { user: { columns: { name: true } } } });
  if (!sp) return;
  const buyer = await db.query.users.findFirst({ where: eq(users.id, buyerId), columns: { name: true } });
  const profile = `/mutaxassislar/${sp.slug}`;
  await notify(buyerId, "subscription_paid", amount ? `Kontakt ochildi — ${formatPrice(amount)}` : "Kontakt ochildi", `${sp.user.name} — telefon, Telegram va boshqa aloqa vositalari endi profilda ko'rinadi.`, profile).catch(() => undefined);
  await notify(sp.userId, "account", "Kontaktingizni mijoz oldi", `${buyer?.name ?? "Mijoz"} profilingizdagi aloqa ma'lumotlaringizni ochdi — tez orada bog'lanishi mumkin.`, "/kabinet/kontaktlar", { skipMail: true }).catch(() => undefined);
  // Adminga daromad xabari (Telegram) — admin botining jonli ogohlantirishi
  if (amount > 0) {
    const { notifyAdminsContactSold } = await import("@/lib/telegram-bot/admin");
    await notifyAdminsContactSold(buyer?.name ?? "Mijoz", sp.user.name, amount).catch(() => undefined);
  }
  void invoiceId;
}

export async function afterContactPaidInvoice(inv: SubscriptionInvoice): Promise<void> {
  const m = contactMeta(inv);
  if (inv.userId) await afterContactPaid(inv.userId, m.specialistId, inv.amount, inv.id);
}

/* ------------------------------------------------------------------ */
/* Ro'yxatlar                                                          */
/* ------------------------------------------------------------------ */
export interface UnlockedContact {
  id: string;
  paidAt: number;
  amount: number;
  specialist: { id: string; slug: string; title: string; category: string; name: string; avatarUrl: string | null; telegram: string | null; instagram: string | null; phone: string | null; email: string | null };
}

/** Mijozning ochilgan kontaktlari (kabinet) — faqat o'ziga; kontaktlar shu yerda to'liq beriladi */
export async function listUnlockedContacts(clientId: string): Promise<UnlockedContact[]> {
  const rows = await db.query.contactUnlocks.findMany({ where: and(eq(contactUnlocks.clientId, clientId), eq(contactUnlocks.status, "paid")), orderBy: [desc(contactUnlocks.paidAt)], limit: 200 });
  if (!rows.length) return [];
  const sps = await db.query.specialists.findMany({ where: inArray(specialists.id, rows.map((r) => r.specialistId)), columns: { id: true, slug: true, title: true, category: true, telegram: true, instagram: true }, with: { user: { columns: { name: true, avatarUrl: true, phone: true, email: true } } } });
  const map = new Map(sps.map((s) => [s.id, s]));
  return rows.flatMap((r) => {
    const s = map.get(r.specialistId);
    if (!s) return [];
    return [{ id: r.id, paidAt: (r.paidAt ?? r.createdAt).getTime(), amount: r.amount, specialist: { id: s.id, slug: s.slug, title: s.title, category: s.category, name: s.user.name, avatarUrl: s.user.avatarUrl, telegram: s.telegram, instagram: s.instagram, phone: s.user.phone, email: s.user.email } }];
  });
}

/** Mutaxassis uchun: kontaktini kim ochgani (ism, sana) — kabinet */
export async function listContactBuyers(specialistId: string): Promise<Array<{ id: string; at: number; amount: number; buyer: { id: string; name: string; avatarUrl: string | null; username: string | null } }>> {
  const rows = await db.query.contactUnlocks.findMany({ where: and(eq(contactUnlocks.specialistId, specialistId), eq(contactUnlocks.status, "paid")), orderBy: [desc(contactUnlocks.paidAt)], limit: 200 });
  if (!rows.length) return [];
  const us = await db.query.users.findMany({ where: inArray(users.id, rows.map((r) => r.clientId)), columns: { id: true, name: true, avatarUrl: true, username: true } });
  const map = new Map(us.map((u) => [u.id, u]));
  return rows.flatMap((r) => {
    const u = map.get(r.clientId);
    return u ? [{ id: r.id, at: (r.paidAt ?? r.createdAt).getTime(), amount: r.amount, buyer: u }] : [];
  });
}

/** Admin statistikasi: jami ochilishlar va tushum */
export async function contactUnlockStats(): Promise<{ count: number; revenue: number; last30: number }> {
  const [t] = await db.select({ count: sql<number>`count(*)`, revenue: sql<number>`coalesce(sum(${contactUnlocks.amount}),0)` }).from(contactUnlocks).where(eq(contactUnlocks.status, "paid"));
  const [m] = await db.select({ n: sql<number>`count(*)` }).from(contactUnlocks).where(and(eq(contactUnlocks.status, "paid"), sql`${contactUnlocks.paidAt} > ${Date.now() - 30 * 86_400_000}`));
  return { count: Number(t?.count ?? 0), revenue: Number(t?.revenue ?? 0), last30: Number(m?.n ?? 0) };
}

/** Admin sahifasi uchun: kutilayotgan qo'lda o'tkazmalar (chek `meta.receiptUrl` bilan) */
export async function pendingContactInvoices(): Promise<Array<{ id: string; state: string; amount: number; title: string; createdAt: number; receiptUrl: string | null; buyer: { id: string; name: string; email: string } | null }>> {
  const rows = await db.query.subscriptionInvoices.findMany({
    where: and(eq(subscriptionInvoices.provider, "manual"), sql`${subscriptionInvoices.state} in ('created','pending')`, sql`json_extract(${subscriptionInvoices.meta}, '$.kind') = 'contact'`),
    orderBy: [desc(subscriptionInvoices.createdAt)],
    limit: 100,
  });
  const ids = rows.map((r) => r.userId).filter((x): x is string => Boolean(x));
  const buyers = ids.length ? await db.query.users.findMany({ where: inArray(users.id, ids), columns: { id: true, name: true, email: true } }) : [];
  const bmap = new Map(buyers.map((b) => [b.id, b]));
  return rows.map((r) => {
    const meta = r.meta as { title?: string; receiptUrl?: string } | null;
    return { id: r.id, state: r.state, amount: r.amount, title: meta?.title ?? "Kontakt", createdAt: r.createdAt.getTime(), receiptUrl: meta?.receiptUrl ?? null, buyer: r.userId ? (bmap.get(r.userId) ?? null) : null };
  });
}

/** So'nggi ochilishlar (admin): kim, kimning kontaktini, qachon, qancha */
export async function recentContactUnlocks(limit = 40): Promise<Array<{ id: string; at: number; amount: number; buyer: { id: string; name: string }; specialist: { id: string; slug: string; name: string } }>> {
  const rows = await db.query.contactUnlocks.findMany({ where: eq(contactUnlocks.status, "paid"), orderBy: [desc(contactUnlocks.paidAt)], limit });
  if (!rows.length) return [];
  const [us, sps] = await Promise.all([
    db.query.users.findMany({ where: inArray(users.id, rows.map((r) => r.clientId)), columns: { id: true, name: true } }),
    db.query.specialists.findMany({ where: inArray(specialists.id, rows.map((r) => r.specialistId)), columns: { id: true, slug: true }, with: { user: { columns: { name: true } } } }),
  ]);
  const um = new Map(us.map((u) => [u.id, u]));
  const sm = new Map(sps.map((s) => [s.id, s]));
  return rows.flatMap((r) => {
    const u = um.get(r.clientId);
    const s = sm.get(r.specialistId);
    return u && s ? [{ id: r.id, at: (r.paidAt ?? r.createdAt).getTime(), amount: r.amount, buyer: u, specialist: { id: s.id, slug: s.slug, name: s.user.name } }] : [];
  });
}
