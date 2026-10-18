import { and, eq, gte, inArray, isNotNull, isNull, lt, lte, ne, notLike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, orders, payments, rateLimits, sessions } from "@/lib/db/schema";
import { closeExpiredJobs } from "@/lib/jobs";
import { notify } from "@/lib/notifications";
import { tashkentNow } from "@/lib/privacy";
import { safeEqual } from "@/lib/payments/config";
import { autoReleaseDate, loadOrderWithParties, onOrderCancelled, orderHref, PROVIDER_PENDING_TTL_MS, recordOrderEvent, releaseOrder } from "@/lib/payments/service";
import { audit } from "@/lib/security/audit";
import { checkSavedSearchAlerts } from "@/lib/saved-searches";
import { runSubscriptionReminders, type ReminderResult } from "@/lib/subscriptions/reminders";
import { remindExpiringVacancies } from "@/lib/vacancies/service";
import { purgeOldViews } from "@/lib/groups/service";
import { formatDate } from "@/lib/utils";
import { postSystemMessage } from "@/app/api/orders/_lib/messages";

export const dynamic = "force-dynamic";

/** Audit jurnali saqlanish muddati */
const AUDIT_RETENTION_DAYS = 180;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Sessiyalar: muddati 7 kundan oldin o'tgan yoki 30 kundan oldin bekor qilingan qatorlar o'chiriladi (qator yo'q = sessiya yopiq) */
const SESSION_EXPIRED_KEEP_DAYS = 7;
const SESSION_REVOKED_KEEP_DAYS = 30;
/** Topshirish sanasidan shuncha kun oldin eslatma (F37) */
const DUE_REMIND_DAYS = 2;
/** SLA (F38): 'new' buyurtma shuncha soatdan keyin eslatiladi / avtomatik bekor qilinadi */
const SLA_REMIND_HOURS = 24;
const SLA_CANCEL_HOURS = 72;
/** Bekor qilishdan oldin eslatma kamida shuncha oldin yuborilgan bo'lsin (kunlik cron kechikishi uchun zaxira bilan) */
const SLA_CANCEL_AFTER_REMIND_HOURS = 20;
const SLA_CANCEL_REASON = "Mutaxassis 72 soat ichida javob bermadi";
const BATCH = 200;

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Kunlik fon vazifasi (E54/E57/E75/F93). Vercel Cron (vercel.json: 03:00 UTC) yoki istalgan tashqi cron chaqiradi.
 * Ruxsat: `Authorization: Bearer <CRON_SECRET>` (Vercel CRON_SECRET bo'lsa uni o'zi yuboradi).
 * Productionda CRON_SECRET MAJBURIY: u bo'lmasa har qanday so'rov rad etiladi (`x-vercel-cron` sarlavhasini
 * istalgan mijoz yuborishi mumkin). Faqat dev rejimida (NODE_ENV !== "production") sirsiz `x-vercel-cron` qabul qilinadi.
 *  (a) Payme/Click 'pending' tranzaksiyalari 12 soatdan eskirgan bo'lsa — bekor (provayder holati -1, sabab 4)
 *  (b) status='done' + paymentState='paid' + autoReleaseAt o'tgan (nizo yo'q) — avtomatik release
 *  (c) eskirgan rate_limits qatorlari va 180 kundan eski audit yozuvlari tozalanadi
 *  (d) F37: topshirish sanasiga (dueDate) 2 kun yoki kamroq qolgan faol buyurtmalar — mijoz va mutaxassisga eslatma (dueRemindedAt)
 *  (e) F38: 24 soatdan beri 'new' turgan buyurtma — mutaxassisga eslatma (slaRemindedAt)
 *  (f) F38: 72 soatdan beri 'new' va eslatma kamida 20 soat oldin yuborilgan — avtomatik bekor
 *      (sabab "Mutaxassis 72 soat ichida javob bermadi", ikkala tomonga xabar). Eslatma sharti — joriy etilgan kuni
 *      eski 'new' buyurtmalar ogohlantirishsiz bir zumda bekor bo'lib ketmasin.
 *  (g) muddati o'tgan ochiq e'lonlar yopiladi (closeExpiredJobs, egasiga job_expired)
 *  (h) saqlangan qidiruvlar: yangi mos mutaxassislar haqida xabar (checkSavedSearchAlerts)
 *  (i) obuna eslatmalari (3 kun / 1 kun qolganda, tugaganda, yashirilganda) + 12 soatdan eski pending obuna hisoblari bekor
 *  (j) eskirgan sessiyalar tozalanadi
 *  (k) muddati 3 kun ichida tugaydigan ochiq vakansiyalar — egasiga bir martalik eslatma (expireRemindedAt)
 * Har bir qadam alohida try/catch ichida — biri yiqilsa, qolganlari ishlayveradi; sonlari JSON javobda va audit meta'da.
 * `?dry=1` — hech narsa o'zgartirmasdan (d)–(f) va (i) bo'yicha nechta yozuv tegishini qaytaradi.
 */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const header = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (secret) return Boolean(m && safeEqual(m[1].trim(), secret));
  if (process.env.NODE_ENV === "production") {
    console.error("[cron] CRON_SECRET sozlanmagan — /api/cron/daily productionda o'chiq. CRON_SECRET o'rnating.");
    return false;
  }
  return Boolean(req.headers.get("x-vercel-cron"));
}

export async function GET(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!authorized(req)) return Response.json({ ok: false, error: "Ruxsat yo'q" }, { status: 401, headers });

  const now = Date.now();
  const nowDate = new Date(now);
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  const counts = {
    expiredPayments: 0,
    autoReleased: 0,
    autoReleaseScheduled: 0,
    rateLimitsDeleted: 0,
    auditDeleted: 0,
    sessionsDeleted: 0,
    dueReminded: 0,
    slaReminded: 0,
    slaCancelled: 0,
    jobsClosed: 0,
    vacanciesReminded: 0,
    viewsPurged: 0,
    savedSearches: null as { checked: number; notified: number } | null,
    subscriptions: null as ReminderResult | null,
    errors: [] as string[],
  };

  if (dry) {
    const r = await orderReminders(now, true);
    const subscriptions = await runSubscriptionReminders({ now: nowDate, dry: true }).catch((e) => {
      console.error("[cron] subscriptions (dry)", e);
      return null;
    });
    const vacanciesReminded = await remindExpiringVacancies(now, true).catch(() => 0);
    return Response.json({ ok: true, dry: true, ts: now, ...r, subscriptions, vacanciesReminded }, { headers });
  }

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

  // (d)–(f) Muddat eslatmalari va SLA
  try {
    const r = await orderReminders(now, false);
    counts.dueReminded = r.dueReminded;
    counts.slaReminded = r.slaReminded;
    counts.slaCancelled = r.slaCancelled;
    counts.errors.push(...r.errors);
  } catch (e) {
    counts.errors.push(`reminders: ${e instanceof Error ? e.message : String(e)}`);
  }

  // (g) Muddati o'tgan e'lonlar (closeExpiredJobs o'zi xato tashlamaydi — baribir himoya)
  try {
    counts.jobsClosed = await closeExpiredJobs(now);
  } catch (e) {
    counts.errors.push(`jobs: ${e instanceof Error ? e.message : String(e)}`);
  }

  // (k) Muddati 3 kun ichida tugaydigan vakansiyalar — egasiga eslatma
  try {
    counts.vacanciesReminded = await remindExpiringVacancies(now);
  } catch (e) {
    counts.errors.push(`vacancies: ${e instanceof Error ? e.message : String(e)}`);
  }
  // (l) Post ko'rishlari dedupe jurnali — 30 kundan eskilari o'chiriladi (hisob posts.views_count'da qoladi)
  try {
    counts.viewsPurged = await purgeOldViews();
  } catch (e) {
    counts.errors.push(`views: ${e instanceof Error ? e.message : String(e)}`);
  }

  // (h) Saqlangan qidiruvlar bo'yicha ogohlantirishlar
  try {
    counts.savedSearches = await checkSavedSearchAlerts(nowDate);
  } catch (e) {
    counts.errors.push(`savedSearches: ${e instanceof Error ? e.message : String(e)}`);
  }

  // (i) Obuna eslatmalari va eskirgan obuna hisoblari
  try {
    counts.subscriptions = await runSubscriptionReminders({ now: nowDate });
  } catch (e) {
    console.error("[cron] subscriptions", e);
    counts.errors.push(`subscriptions: ${e instanceof Error ? e.message : String(e)}`);
  }

  // (c) Tozalash
  try {
    const res = await db.delete(rateLimits).where(lt(rateLimits.resetAt, now));
    counts.rateLimitsDeleted = res.rowsAffected;
  } catch (e) {
    counts.errors.push(`rateLimits: ${e instanceof Error ? e.message : String(e)}`);
  }
  try {
    // Pul va egalik izi (to'lov/payout/admin amallari, fayl yuklash) muddatidan qat'i nazar SAQLANADI —
    // faqat oddiy (kirish, ko'rish va h.k.) yozuvlar 180 kundan keyin o'chadi
    const res = await db
      .delete(auditLogs)
      .where(
        and(
          lt(auditLogs.createdAt, new Date(now - AUDIT_RETENTION_DAYS * DAY_MS)),
          ne(auditLogs.action, "upload"),
          notLike(auditLogs.action, "pay%"),
          notLike(auditLogs.action, "admin_%"),
        ),
      );
    counts.auditDeleted = res.rowsAffected;
  } catch (e) {
    counts.errors.push(`audit: ${e instanceof Error ? e.message : String(e)}`);
  }
  // (j) Sessiyalar (login ham vaqti-vaqti bilan foydalanuvchi bo'yicha tozalaydi)
  try {
    const res = await db
      .delete(sessions)
      .where(or(lt(sessions.expiresAt, new Date(now - SESSION_EXPIRED_KEEP_DAYS * DAY_MS)), lt(sessions.revokedAt, new Date(now - SESSION_REVOKED_KEEP_DAYS * DAY_MS))));
    counts.sessionsDeleted = res.rowsAffected;
  } catch (e) {
    counts.errors.push(`sessions: ${e instanceof Error ? e.message : String(e)}`);
  }

  await audit(null, "cron_daily", { targetType: "system", meta: { ...counts, errors: counts.errors.length ? counts.errors : undefined } });
  return Response.json({ ok: counts.errors.length === 0, ts: now, ...counts }, { headers });
}

/** (d)–(f): topshirish sanasi eslatmalari, SLA eslatmasi va 72 soatlik avtomatik bekor qilish */
async function orderReminders(now: number, dry: boolean): Promise<{ dueReminded: number; slaReminded: number; slaCancelled: number; errors: string[] }> {
  const out = { dueReminded: 0, slaReminded: 0, slaCancelled: 0, errors: [] as string[] };
  const nowDate = new Date(now);
  const today = tashkentNow(now).date;

  // (d) Topshirish sanasi yaqin: bugun..bugun+2, faol buyurtma, hali eslatilmagan
  const dueSoon = await db.query.orders.findMany({
    where: and(inArray(orders.status, ["accepted", "in_progress"]), isNotNull(orders.dueDate), gte(orders.dueDate, today), lte(orders.dueDate, addDays(today, DUE_REMIND_DAYS)), isNull(orders.dueRemindedAt)),
    columns: { id: true },
    limit: BATCH,
  });
  if (dry) out.dueReminded = dueSoon.length;
  else {
    for (const { id } of dueSoon) {
      try {
        // Holatga bog'liq belgilash: parallel cron chaqiruvida eslatma ikki marta ketmaydi
        const res = await db.update(orders).set({ dueRemindedAt: nowDate }).where(and(eq(orders.id, id), isNull(orders.dueRemindedAt)));
        if (!res.rowsAffected) continue;
        const o = await loadOrderWithParties(id);
        if (!o || !o.dueDate) continue;
        const left = o.dueDate === today ? "bugun" : o.dueDate === addDays(today, 1) ? "ertaga" : `${formatDate(o.dueDate)} (2 kun qoldi)`;
        await notify(o.specialist.userId, "order_due", `Topshirish muddati ${left}`, `«${o.title}» — mijozga ${formatDate(o.dueDate)} gacha topshirishingiz kerak. Kechiksa, chat orqali oldindan ogohlantiring.`, orderHref(o.id));
        await notify(o.clientId, "order_due", `Buyurtma muddati ${left}`, `«${o.title}» — ${o.specialist.user.name} ishni ${formatDate(o.dueDate)} gacha topshirishi kerak.`, orderHref(o.id));
        out.dueReminded += 1;
      } catch (e) {
        out.errors.push(`due ${id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  // (e) SLA eslatmasi: 24 soatdan beri javobsiz 'new'
  const slaRemind = await db.query.orders.findMany({
    where: and(eq(orders.status, "new"), lt(orders.createdAt, new Date(now - SLA_REMIND_HOURS * HOUR_MS)), isNull(orders.slaRemindedAt)),
    columns: { id: true },
    limit: BATCH,
  });
  if (dry) out.slaReminded = slaRemind.length;
  else {
    for (const { id } of slaRemind) {
      try {
        const res = await db.update(orders).set({ slaRemindedAt: nowDate }).where(and(eq(orders.id, id), isNull(orders.slaRemindedAt), eq(orders.status, "new")));
        if (!res.rowsAffected) continue;
        const o = await loadOrderWithParties(id);
        if (!o) continue;
        await notify(
          o.specialist.userId,
          "order_sla",
          `Mijoz javobingizni kutmoqda: ${o.title}`,
          `${o.client.name} buyurtmasi 24 soatdan beri javobsiz. Qabul qiling yoki sabab bilan rad eting — ${SLA_CANCEL_HOURS} soat ichida javob bo'lmasa buyurtma avtomatik bekor qilinadi.`,
          orderHref(o.id),
        );
        out.slaReminded += 1;
      } catch (e) {
        out.errors.push(`sla ${id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  // (f) SLA avtomatik bekor: 72 soatdan beri 'new' va eslatma kamida 20 soat oldin yuborilgan
  const slaCancelRows = await db.query.orders.findMany({
    where: and(
      eq(orders.status, "new"),
      lt(orders.createdAt, new Date(now - SLA_CANCEL_HOURS * HOUR_MS)),
      isNotNull(orders.slaRemindedAt),
      lte(orders.slaRemindedAt, new Date(now - SLA_CANCEL_AFTER_REMIND_HOURS * HOUR_MS)),
    ),
    columns: { id: true },
    with: { specialist: { columns: { vacationUntil: true } } },
    limit: BATCH,
  });
  // Mutaxassis ta'tilda bo'lsa buyurtma bekor qilinmaydi — ta'til tugaganidan keyin yana 72 soat kutiladi
  const vacationHolds = (vac: string | null | undefined): boolean => {
    if (!vac) return false;
    const end = new Date(`${vac}T00:00:00Z`).getTime();
    return Number.isFinite(end) && now < end + SLA_CANCEL_HOURS * HOUR_MS;
  };
  const slaCancel = slaCancelRows.filter((o) => !vacationHolds(o.specialist?.vacationUntil));
  if (dry) out.slaCancelled = slaCancel.length;
  else {
    for (const { id } of slaCancel) {
      try {
        const res = await db
          .update(orders)
          .set({ status: "cancelled", cancelReason: SLA_CANCEL_REASON, autoReleaseAt: null, updatedAt: nowDate })
          .where(and(eq(orders.id, id), eq(orders.status, "new")));
        if (!res.rowsAffected) continue;
        const o = await loadOrderWithParties(id);
        if (!o) continue;
        await onOrderCancelled(o, o.specialist.userId, SLA_CANCEL_REASON);
        await recordOrderEvent(id, null, "status", { fromStatus: "new", toStatus: "cancelled", note: `Sabab: ${SLA_CANCEL_REASON} (avtomatik)` });
        await postSystemMessage(id, `Buyurtma avtomatik bekor qilindi. Sabab: ${SLA_CANCEL_REASON}`);
        await audit(null, "order_status", { targetType: "order", targetId: id, meta: { from: "new", to: "cancelled", reason: SLA_CANCEL_REASON, auto: true } });
        await notify(o.clientId, "order_cancelled", "Buyurtma avtomatik bekor qilindi", `«${o.title}» — ${SLA_CANCEL_REASON}. Boshqa mutaxassisni tanlashingiz yoki e'lon joylashingiz mumkin.`, orderHref(o.id));
        await notify(o.specialist.userId, "order_cancelled", "Buyurtma avtomatik bekor qilindi", `«${o.title}» — ${SLA_CANCEL_REASON}. Kelgan buyurtmalarga tezroq javob bering — bu reytingingizga ta'sir qiladi.`, orderHref(o.id));
        out.slaCancelled += 1;
      } catch (e) {
        out.errors.push(`slaCancel ${id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  return out;
}
