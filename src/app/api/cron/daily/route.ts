import { and, eq, inArray, isNull, lt, lte, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, orders, payments, rateLimits } from "@/lib/db/schema";
import { safeEqual } from "@/lib/payments/config";
import { autoReleaseDate, PROVIDER_PENDING_TTL_MS, releaseOrder } from "@/lib/payments/service";
import { audit } from "@/lib/security/audit";

export const dynamic = "force-dynamic";

/** Audit jurnali saqlanish muddati */
const AUDIT_RETENTION_DAYS = 180;

/**
 * Kunlik fon vazifasi (E54/E57/E75/F93). Vercel Cron (vercel.json: 03:00 UTC) yoki istalgan tashqi cron chaqiradi.
 * Ruxsat: `Authorization: Bearer <CRON_SECRET>` (Vercel CRON_SECRET bo'lsa uni o'zi yuboradi).
 * CRON_SECRET sozlanmagan bo'lsa — faqat Vercel'ning `x-vercel-cron` sarlavhasi (yoki dev rejimi) bilan.
 *  (a) Payme/Click 'pending' tranzaksiyalari 12 soatdan eskirgan bo'lsa — bekor (provayder holati -1, sabab 4)
 *  (b) status='done' + paymentState='paid' + autoReleaseAt o'tgan (nizo yo'q) — avtomatik release
 *  (c) eskirgan rate_limits qatorlari va 180 kundan eski audit yozuvlari tozalanadi
 */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const header = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (secret) return Boolean(m && safeEqual(m[1].trim(), secret));
  const vercelCron = Boolean(req.headers.get("x-vercel-cron"));
  return vercelCron && (Boolean(process.env.VERCEL) || process.env.NODE_ENV !== "production");
}

export async function GET(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!authorized(req)) return Response.json({ ok: false, error: "Ruxsat yo'q" }, { status: 401, headers });

  const now = Date.now();
  const nowDate = new Date(now);
  const counts = { expiredPayments: 0, autoReleased: 0, autoReleaseScheduled: 0, rateLimitsDeleted: 0, auditDeleted: 0, errors: [] as string[] };

  // (a) Eskirgan provayder tranzaksiyalari
  try {
    const res = await db
      .update(payments)
      .set({ state: "cancelled", providerState: -1, cancelTime: now, cancelReason: 4, updatedAt: nowDate })
      .where(and(eq(payments.state, "pending"), inArray(payments.provider, ["payme", "click"]), lt(sql`coalesce(${payments.providerCreateTime}, ${payments.createdAt})`, now - PROVIDER_PENDING_TTL_MS)));
    counts.expiredPayments = res.rowsAffected;
  } catch (e) {
    counts.errors.push(`expire: ${e instanceof Error ? e.message : String(e)}`);
  }

  // (b0) Eski yozuvlar: done+paid, lekin muddat belgilanmagan — bugundan 7 kun
  try {
    const res = await db
      .update(orders)
      .set({ autoReleaseAt: autoReleaseDate(now), updatedAt: nowDate })
      .where(and(eq(orders.status, "done"), eq(orders.paymentState, "paid"), isNull(orders.autoReleaseAt), ne(orders.disputeState, "open")));
    counts.autoReleaseScheduled = res.rowsAffected;
  } catch (e) {
    counts.errors.push(`schedule: ${e instanceof Error ? e.message : String(e)}`);
  }

  // (b) Avtomatik release
  try {
    const due = await db.query.orders.findMany({
      where: and(eq(orders.status, "done"), eq(orders.paymentState, "paid"), lte(orders.autoReleaseAt, nowDate), ne(orders.disputeState, "open")),
      columns: { id: true },
      limit: 200,
    });
    for (const o of due) {
      try {
        const { released } = await releaseOrder(o.id, null, undefined, { auto: true });
        if (released.length) counts.autoReleased += 1;
      } catch (e) {
        counts.errors.push(`release ${o.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  } catch (e) {
    counts.errors.push(`autoRelease: ${e instanceof Error ? e.message : String(e)}`);
  }

  // (c) Tozalash
  try {
    const res = await db.delete(rateLimits).where(lt(rateLimits.resetAt, now));
    counts.rateLimitsDeleted = res.rowsAffected;
  } catch (e) {
    counts.errors.push(`rateLimits: ${e instanceof Error ? e.message : String(e)}`);
  }
  try {
    const res = await db.delete(auditLogs).where(lt(auditLogs.createdAt, new Date(now - AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000)));
    counts.auditDeleted = res.rowsAffected;
  } catch (e) {
    counts.errors.push(`audit: ${e instanceof Error ? e.message : String(e)}`);
  }

  await audit(null, "cron_daily", { targetType: "system", meta: { ...counts, errors: counts.errors.length ? counts.errors : undefined } });
  return Response.json({ ok: counts.errors.length === 0, ts: now, ...counts }, { headers });
}
