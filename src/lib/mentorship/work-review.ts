import "server-only";
import { and, asc, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { mentors, subscriptionInvoices, users, workReviews, type FileAttachment } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import { notify, notifyAdmins } from "@/lib/notifications";
import { uid } from "@/lib/utils";
import { attachmentFileId, privateFileUrl } from "@/lib/media/private-url";
import { attachmentSchema } from "@/app/api/orders/_lib/attachments";
import { WORK_REVIEW, type WorkReviewStatus } from "./format";

/**
 * «Ishimni baholang» (2026-11-12) — talaba ustozga ishini yuboradi va pullik yozma (+video) sharh oladi.
 *
 * Oqim: talaba so'rov yaratadi (`createWorkReview`: havola yoki o'z yuklamasi + izoh) → qator `pending_payment`.
 * Narx 0 bo'lsa route darhol `startPurchase` bepul yo'lini chaqiradi; aks holda mavjud xarid oynasi (PurchaseDialog,
 * type="review", id = qator id'si) → Payme/Click/qo'lda o'tkazma → `fulfillPurchase` → `waiting`. Ustoz javob beradi
 * (`answerWorkReview`) → `done` + talabaga bildirishnoma. Qaytarish → `revokePurchase` → `refunded`.
 *
 * Ruxsat: talaba (egasi), ustoz va adminlar; boshqalarga 404. Fayllar DTO'da `/api/media/review/<id>_<0|1>` route'iga
 * almashadi (0 — talabaning ishi, 1 — ustozning javob videosi), xom saqlash manzili klientga chiqmaydi.
 */

/* ------------------------------------------------------------------ */
/* Sxemalar                                                            */
/* ------------------------------------------------------------------ */

/** Tashqi ish havolasi: faqat https, login/parolsiz, nuqtali xost (YouTube, Behance, Google Drive…) */
export const workUrlSchema = z
  .string()
  .trim()
  .max(500, { error: "Havola juda uzun" })
  .refine(
    (v) => {
      try {
        const u = new URL(v);
        return u.protocol === "https:" && !u.username && !u.password && /\.[a-z]{2,}$/i.test(u.hostname);
      } catch {
        return false;
      }
    },
    { error: "Havola https:// bilan boshlanishi kerak" },
  );

export const workReviewSettingsSchema = z
  .object({
    enabled: z.boolean(),
    price: z.coerce.number().int({ error: "Narx butun son bo'lsin" }).min(0).max(WORK_REVIEW.priceMax, { error: `Narx ko'pi bilan ${WORK_REVIEW.priceMax.toLocaleString("ru-RU")} so'm` }),
    about: z.string().trim().max(WORK_REVIEW.aboutMax, { error: `Tavsif ko'pi bilan ${WORK_REVIEW.aboutMax} belgi` }),
    days: z.coerce.number().int().min(WORK_REVIEW.daysMin, { error: "Muddat 1–14 kun" }).max(WORK_REVIEW.daysMax, { error: "Muddat 1–14 kun" }),
  })
  .refine((d) => d.price === 0 || d.price >= WORK_REVIEW.priceMin, { error: "Narx 0 (bepul) yoki kamida 5 000 so'm", path: ["price"] })
  .refine((d) => !d.enabled || d.about.length >= 10, { error: "Nimani baholashingizni qisqacha yozing (kamida 10 belgi)", path: ["about"] });
export type WorkReviewSettings = z.infer<typeof workReviewSettingsSchema>;

export const workReviewCreateSchema = z
  .object({
    mentorId: z.string().trim().min(1).max(80),
    workUrl: workUrlSchema.optional(),
    workFile: attachmentSchema.optional(),
    note: z.string().trim().max(WORK_REVIEW.noteMax, { error: `Izoh ko'pi bilan ${WORK_REVIEW.noteMax} belgi` }).default(""),
  })
  .refine((d) => Boolean(d.workUrl || d.workFile), { error: "Ish havolasini kiriting yoki faylni yuklang", path: ["workUrl"] });

export const workReviewAnswerSchema = z.object({
  response: z
    .string()
    .trim()
    .min(WORK_REVIEW.responseMin, { error: `Sharh kamida ${WORK_REVIEW.responseMin} belgi bo'lsin` })
    .max(WORK_REVIEW.responseMax, { error: `Sharh ko'pi bilan ${WORK_REVIEW.responseMax} belgi` }),
  responseVideo: attachmentSchema
    .refine((a) => a.type.startsWith("video/"), { error: "Javob videosi MP4, WebM yoki MOV bo'lsin" })
    .optional(),
});

/* ------------------------------------------------------------------ */
/* DTO                                                                 */
/* ------------------------------------------------------------------ */
export interface WorkReviewView {
  id: string;
  status: WorkReviewStatus;
  price: number;
  days: number;
  workUrl: string | null;
  workFile: FileAttachment | null;
  note: string;
  response: string;
  responseVideo: FileAttachment | null;
  createdAt: number;
  paidAt: number | null;
  dueAt: number | null;
  answeredAt: number | null;
  /** Muddat o'tgan va hali javob yo'q */
  overdue: boolean;
  /** Talaba pulni qaytarishni so'ragan (vaqti) */
  refundRequestedAt: number | null;
  mentor: { id: string; name: string; slug: string | null; avatarUrl: string | null };
  student: { id: string; name: string; avatarUrl: string | null };
}

type Row = typeof workReviews.$inferSelect;

/** Fayl → himoyalangan route (xom manzil klientga chiqmaydi); muqova ham alohida route */
function protect(id: string, index: number, a: FileAttachment | null): FileAttachment | null {
  if (!a) return null;
  return { ...a, url: privateFileUrl("review", attachmentFileId(id, index)), ...(a.poster ? { poster: privateFileUrl("review", attachmentFileId(id, index, true)) } : {}) };
}

async function toViews(rows: Row[]): Promise<WorkReviewView[]> {
  if (!rows.length) return [];
  const mentorRows = await db.query.mentors.findMany({ where: inArray(mentors.id, [...new Set(rows.map((r) => r.mentorId))]), columns: { id: true, slug: true }, with: { user: { columns: { name: true, avatarUrl: true } } } });
  const studentRows = await db.query.users.findMany({ where: inArray(users.id, [...new Set(rows.map((r) => r.userId))]), columns: { id: true, name: true, avatarUrl: true } });
  const mm = new Map(mentorRows.map((m) => [m.id, m]));
  const sm = new Map(studentRows.map((u) => [u.id, u]));
  return rows.map((r) => {
    const m = mm.get(r.mentorId);
    const s = sm.get(r.userId);
    return {
      id: r.id,
      status: r.status,
      price: r.price,
      days: r.days,
      workUrl: r.workUrl,
      workFile: protect(r.id, 0, r.workFile ?? null),
      note: r.note,
      response: r.status === "done" || r.status === "refunded" ? r.response : "",
      responseVideo: r.status === "done" || r.status === "refunded" ? protect(r.id, 1, r.responseVideo ?? null) : null,
      createdAt: r.createdAt.getTime(),
      paidAt: r.paidAt?.getTime() ?? null,
      dueAt: r.dueAt?.getTime() ?? null,
      answeredAt: r.answeredAt?.getTime() ?? null,
      overdue: r.status === "waiting" && Boolean(r.dueAt && r.dueAt.getTime() < Date.now()),
      refundRequestedAt: r.refundRequestedAt?.getTime() ?? null,
      mentor: { id: r.mentorId, name: m?.user.name ?? "Ustoz", slug: m?.slug ?? null, avatarUrl: m?.user.avatarUrl ?? null },
      student: { id: r.userId, name: s?.name ?? "Talaba", avatarUrl: s?.avatarUrl ?? null },
    };
  });
}

/* ------------------------------------------------------------------ */
/* Ustoz sozlamasi                                                     */
/* ------------------------------------------------------------------ */
export async function updateWorkReviewSettings(mentorId: string, actor: { id: string; admin: boolean }, input: WorkReviewSettings): Promise<void> {
  const m = await db.query.mentors.findFirst({ where: eq(mentors.id, mentorId), columns: { id: true, userId: true, isApproved: true } });
  if (!m) throw new ApiError(404, "Mentor topilmadi");
  if (m.userId !== actor.id && !actor.admin) throw new ApiError(403, "Bu sahifa sizniki emas");
  if (input.enabled && !m.isApproved) throw new ApiError(409, "Xizmat faqat tasdiqlangan ustozlarda yoqiladi");
  await db.update(mentors).set({ reviewEnabled: input.enabled, reviewPrice: input.price, reviewAbout: input.about, reviewDays: input.days }).where(eq(mentors.id, mentorId));
}

/* ------------------------------------------------------------------ */
/* Talaba: so'rov yaratish / bekor qilish / ro'yxat                    */
/* ------------------------------------------------------------------ */
export async function createWorkReview(userId: string, input: z.infer<typeof workReviewCreateSchema>): Promise<{ id: string; price: number }> {
  const m = await db.query.mentors.findFirst({ where: eq(mentors.id, input.mentorId) });
  if (!m || !m.isApproved || !m.reviewEnabled) throw new ApiError(404, "Ustoz hozir ish sharhi qabul qilmaydi");
  if (m.userId === userId) throw new ApiError(400, "O'z xizmatingizdan foydalana olmaysiz");
  const [open] = await db
    .select({ n: sql<number>`count(*)` })
    .from(workReviews)
    .where(and(eq(workReviews.userId, userId), eq(workReviews.status, "pending_payment")));
  if (Number(open?.n ?? 0) >= WORK_REVIEW.openMax) throw new ApiError(429, "To'lanmagan so'rovlaringiz ko'p — avval ularni to'lang yoki bekor qiling");
  const id = uid();
  await db.insert(workReviews).values({
    id,
    mentorId: m.id,
    userId,
    status: "pending_payment",
    price: m.reviewPrice,
    days: m.reviewDays,
    workUrl: input.workUrl ?? null,
    workFile: input.workFile ?? null,
    note: input.note,
  });
  return { id, price: m.reviewPrice };
}

/** Talaba to'lanmagan so'rovini bekor qiladi (ochiq hisoblar ham yopiladi) */
export async function cancelWorkReview(id: string, userId: string): Promise<void> {
  const r = await db.query.workReviews.findFirst({ where: eq(workReviews.id, id), columns: { userId: true, status: true } });
  if (!r || r.userId !== userId) throw new ApiError(404, "So'rov topilmadi");
  const res = await db.update(workReviews).set({ status: "cancelled" }).where(and(eq(workReviews.id, id), eq(workReviews.status, "pending_payment")));
  if ((res.rowsAffected ?? 0) === 0) throw new ApiError(409, "To'langan so'rovni bekor qilib bo'lmaydi — ustoz bilan bog'laning");
  await db
    .update(subscriptionInvoices)
    .set({ state: "cancelled", providerState: -1, cancelTime: Date.now(), cancelReason: 3, updatedAt: new Date() })
    .where(and(eq(subscriptionInvoices.userId, userId), eq(subscriptionInvoices.state, "created"), sql`json_extract(${subscriptionInvoices.meta}, '$.kind') = 'purchase'`, sql`json_extract(${subscriptionInvoices.meta}, '$.type') = 'review'`, sql`json_extract(${subscriptionInvoices.meta}, '$.itemId') = ${id}`));
}

/** Talabaning so'rovlari (bekor qilinganlar ko'rsatilmaydi) */
export async function listMyWorkReviews(userId: string, limit = 30): Promise<WorkReviewView[]> {
  const rows = await db.query.workReviews.findMany({
    where: and(eq(workReviews.userId, userId), inArray(workReviews.status, ["pending_payment", "waiting", "done", "refunded"])),
    orderBy: [desc(workReviews.createdAt)],
    limit,
  });
  return toViews(rows);
}

/* ------------------------------------------------------------------ */
/* Ustoz: kutish ro'yxati va javob                                     */
/* ------------------------------------------------------------------ */
/** Ustoz (yoki admin — barcha ustozlar) uchun: kutilayotganlar (muddat bo'yicha) + so'nggi javob berilganlar */
export async function listMentorWorkReviews(userId: string, admin: boolean): Promise<{ waiting: WorkReviewView[]; done: WorkReviewView[] }> {
  const m = await db.query.mentors.findFirst({ where: eq(mentors.userId, userId), columns: { id: true } });
  if (!m && !admin) return { waiting: [], done: [] };
  const scope = m && !admin ? eq(workReviews.mentorId, m.id) : undefined;
  const [waiting, done] = await Promise.all([
    db.query.workReviews.findMany({ where: and(scope, eq(workReviews.status, "waiting")), orderBy: [asc(workReviews.dueAt)], limit: 100 }),
    db.query.workReviews.findMany({ where: and(scope, eq(workReviews.status, "done")), orderBy: [desc(workReviews.answeredAt)], limit: 20 }),
  ]);
  return { waiting: await toViews(waiting), done: await toViews(done) };
}

/** Ustozning javob kutayotgan so'rovlari soni (kabinet belgisi) */
export async function waitingWorkReviewsCount(mentorId: string): Promise<number> {
  const [r] = await db.select({ n: sql<number>`count(*)` }).from(workReviews).where(and(eq(workReviews.mentorId, mentorId), eq(workReviews.status, "waiting")));
  return Number(r?.n ?? 0);
}

/** Ruxsat: talaba / ustoz / admin; boshqalarga 404 (so'rov borligi oshkor bo'lmasin) */
async function loadForParty(id: string, viewer: { id: string; admin: boolean }) {
  const r = await db.query.workReviews.findFirst({ where: eq(workReviews.id, id), with: { mentor: { columns: { userId: true } } } });
  if (!r) throw new ApiError(404, "So'rov topilmadi");
  const isStudent = r.userId === viewer.id;
  const isMentor = r.mentor.userId === viewer.id;
  if (!isStudent && !isMentor && !viewer.admin) throw new ApiError(404, "So'rov topilmadi");
  return { r, isStudent, isMentor };
}

export async function getWorkReview(id: string, viewer: { id: string; admin: boolean }): Promise<WorkReviewView> {
  const { r, isStudent } = await loadForParty(id, viewer);
  // Ustoz to'lanmagan so'rovni ko'rmaydi (u hali unga yuborilmagan)
  if (!isStudent && !viewer.admin && r.status === "pending_payment") throw new ApiError(404, "So'rov topilmadi");
  const [v] = await toViews([r]);
  return v;
}

export async function answerWorkReview(id: string, viewer: { id: string; admin: boolean }, input: z.infer<typeof workReviewAnswerSchema>, verifyUploads?: () => Promise<void>): Promise<void> {
  const { r, isMentor } = await loadForParty(id, viewer);
  if (!isMentor && !viewer.admin) throw new ApiError(403, "Faqat ustoz javob beradi");
  if (r.status !== "waiting") throw new ApiError(409, r.status === "done" ? "Bu so'rovga allaqachon javob berilgan" : "So'rov javob kutmayapti");
  if (verifyUploads) await verifyUploads();
  const res = await db
    .update(workReviews)
    .set({ status: "done", response: input.response, responseVideo: input.responseVideo ?? null, answeredAt: new Date() })
    .where(and(eq(workReviews.id, id), eq(workReviews.status, "waiting")));
  if ((res.rowsAffected ?? 0) === 0) throw new ApiError(409, "So'rov holati o'zgardi — sahifani yangilang");
  const mentorName = (await db.query.users.findFirst({ where: eq(users.id, r.mentor.userId), columns: { name: true } }))?.name ?? "Ustoz";
  await notify(r.userId, "subscription_paid", "Ishingizga sharh tayyor", `${mentorName}: ${input.response.slice(0, 140)}`, "/kabinet/mentorlik#ish-sharhlari").catch(() => undefined);
}

/** Yopiq fayl ruxsati (private-access.ts): 0 — talabaning ishi, 1 — javob videosi */
export async function resolveWorkReviewFile(id: string, index: number, viewer: { id: string; admin: boolean }): Promise<FileAttachment | null> {
  const r = await db.query.workReviews.findFirst({ where: eq(workReviews.id, id), with: { mentor: { columns: { userId: true } } } });
  if (!r) return null;
  const isStudent = r.userId === viewer.id;
  const isMentor = r.mentor.userId === viewer.id;
  if (!isStudent && !isMentor && !viewer.admin) return null;
  if (index === 0) return isMentor && !viewer.admin && r.status === "pending_payment" ? null : (r.workFile ?? null);
  if (index === 1) return r.status === "done" || r.status === "refunded" ? (r.responseVideo ?? null) : null;
  return null;
}

/* ------------------------------------------------------------------ */
/* Kechikish: eslatma, ogohlantirish, qaytarish so'rovi (2026-11-12)    */
/* ------------------------------------------------------------------ */
/** Muddatdan keyin admin va talabaga xabar berilguncha kutiladigan vaqt */
export const WORK_REVIEW_ESCALATE_MS = 48 * 3_600_000;

/**
 * Kunlik cron: (1) muddati o'tgan, javobsiz so'rov — ustozga bir martalik eslatma; (2) muddatdan 48 soat o'tib ham javob
 * yo'q — adminlarga (qaytarishni ko'rib chiqish uchun) va talabaga (kechikish + qaytarishni so'rash imkoniyati) xabar.
 * Har bosqich CAS bilan band qilinadi — cron ikki marta ishlasa ham xabar takrorlanmaydi. Pul AVTOMATIK qaytarilmaydi:
 * qo'lda o'tkazma bo'lsa pulni mijozga admin qaytaradi, shuning uchun qarorni ham admin qabul qiladi.
 */
export async function processOverdueWorkReviews(now = Date.now()): Promise<{ reminded: number; escalated: number }> {
  let reminded = 0;
  let escalated = 0;
  const due = await db.query.workReviews.findMany({
    where: and(eq(workReviews.status, "waiting"), lt(workReviews.dueAt, new Date(now)), isNull(workReviews.remindedAt)),
    columns: { id: true, userId: true },
    with: { mentor: { columns: { userId: true } } },
    limit: 200,
  });
  for (const r of due) {
    const res = await db.update(workReviews).set({ remindedAt: new Date(now) }).where(and(eq(workReviews.id, r.id), isNull(workReviews.remindedAt)));
    if ((res.rowsAffected ?? 0) === 0) continue;
    const student = (await db.query.users.findFirst({ where: eq(users.id, r.userId), columns: { name: true } }))?.name ?? "Talaba";
    await notify(r.mentor.userId, "subscription_paid", "Ish sharhi muddati o'tdi", `${student} ishiga sharh kutmoqda — iltimos, imkon qadar tezroq javob bering.`, "/kabinet/mentorlik/vazifalar").catch(() => undefined);
    reminded++;
  }
  const late = await db.query.workReviews.findMany({
    where: and(eq(workReviews.status, "waiting"), lt(workReviews.dueAt, new Date(now - WORK_REVIEW_ESCALATE_MS)), isNull(workReviews.escalatedAt)),
    columns: { id: true, userId: true, price: true },
    with: { mentor: { columns: { userId: true } } },
    limit: 200,
  });
  for (const r of late) {
    const res = await db.update(workReviews).set({ escalatedAt: new Date(now) }).where(and(eq(workReviews.id, r.id), isNull(workReviews.escalatedAt)));
    if ((res.rowsAffected ?? 0) === 0) continue;
    const mentorName = (await db.query.users.findFirst({ where: eq(users.id, r.mentor.userId), columns: { name: true } }))?.name ?? "Ustoz";
    await notifyAdmins("report", "Ish sharhi 2 kundan beri kechikmoqda", `${mentorName} — muddat o'tganiga 48 soatdan oshdi. Ustoz bilan bog'laning yoki xaridni qaytaring.`, "/admin/mentorlik", { skipMail: true }).catch(() => undefined);
    await notify(
      r.userId,
      "subscription_paid",
      "Ustoz sharhni kechiktirmoqda",
      r.price > 0 ? `${mentorName} hali javob bermadi. Kutishingiz yoki pulni qaytarishni so'rashingiz mumkin.` : `${mentorName} hali javob bermadi. Kutishingiz yoki so'rovni bekor qilishingiz mumkin.`,
      "/kabinet/mentorlik#ish-sharhlari",
    ).catch(() => undefined);
    escalated++;
  }
  return { reminded, escalated };
}

/**
 * Talaba: muddati o'tgan so'rov bo'yicha — bepul bo'lsa bekor qiladi, pullik bo'lsa qaytarishni so'raydi (adminga xabar;
 * qaror va pulni qaytarish adminning o'zida). Takror so'rov — o'zgarishsiz qaytadi.
 */
export async function requestWorkReviewRefund(id: string, userId: string): Promise<{ status: "cancelled" | "requested" }> {
  const r = await db.query.workReviews.findFirst({ where: eq(workReviews.id, id), with: { mentor: { columns: { userId: true } } } });
  if (!r || r.userId !== userId) throw new ApiError(404, "So'rov topilmadi");
  if (r.status !== "waiting") throw new ApiError(409, "Bu so'rov javob kutmayapti");
  if (!r.dueAt || r.dueAt.getTime() > Date.now()) throw new ApiError(409, "Muddat hali tugamagan — ustoz javobini kuting");
  if (r.price <= 0) {
    const res = await db.update(workReviews).set({ status: "cancelled" }).where(and(eq(workReviews.id, id), eq(workReviews.status, "waiting")));
    if ((res.rowsAffected ?? 0) === 0) throw new ApiError(409, "So'rov holati o'zgardi — sahifani yangilang");
    return { status: "cancelled" };
  }
  if (r.refundRequestedAt) return { status: "requested" };
  const res = await db.update(workReviews).set({ refundRequestedAt: new Date() }).where(and(eq(workReviews.id, id), eq(workReviews.status, "waiting"), isNull(workReviews.refundRequestedAt)));
  if ((res.rowsAffected ?? 0) > 0) {
    const [student, mentorName] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, userId), columns: { name: true } }),
      db.query.users.findFirst({ where: eq(users.id, r.mentor.userId), columns: { name: true } }),
    ]);
    await notifyAdmins("report", "Ish sharhi uchun pulni qaytarish so'raldi", `${student?.name ?? "Talaba"} → ${mentorName?.name ?? "ustoz"}: ${r.price.toLocaleString("ru-RU").replace(/\u00a0/g, " ")} so'm, muddat o'tgan.`, "/admin/mentorlik").catch(() => undefined);
  }
  return { status: "requested" };
}
