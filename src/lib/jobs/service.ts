import "server-only";
import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobs, orders, proposals, specialists, users } from "@/lib/db/schema";
import { ApiError } from "@/lib/api";
import type { SessionPayload } from "@/lib/auth";
import { JOB_TTL_DAYS, PROPOSAL_DAILY_LIMIT } from "@/lib/constants";
import { notify } from "@/lib/notifications";
import { orderHref, recordOrderEvent } from "@/lib/payments/service";
import { commissionPctFor, getSettings } from "@/lib/payments/settings";
import { canReceiveOrders } from "@/lib/subscriptions/access";
import { tashkentNow } from "@/lib/privacy";
import { audit } from "@/lib/security/audit";
import { formatPrice, uid } from "@/lib/utils";
import { jobHref, notifyJob, proposalsSentToday, syncProposalsCount } from "./server";
import { findExpiredOpenJobs, getJobRow, specialistForUser } from "./queries";
import type { JobInput, ProposalInput } from "./validators";

const DAY = 24 * 60 * 60 * 1000;
const jobExpiry = (from = Date.now()) => new Date(from + JOB_TTL_DAYS * DAY);
export const SUBSCRIPTION_HREF = "/kabinet/obuna";
export const SUBSCRIPTION_INACTIVE = "Obunangiz faol emas — taklif yuborish uchun obunani yangilang";

/* ------------------------------------------------------------------ */
/* E'lonlar                                                            */
/* ------------------------------------------------------------------ */
export async function createJob(session: SessionPayload, input: JobInput): Promise<{ id: string }> {
  if (session.role !== "client" && session.role !== "admin") throw new ApiError(403, "E'lonni faqat mijozlar joylaydi");
  const id = uid();
  const now = new Date();
  await db.insert(jobs).values({
    id,
    clientId: session.sub,
    title: input.title,
    description: input.description,
    category: input.category,
    regionSlug: input.regionSlug,
    budgetMin: input.budgetMin,
    budgetMax: input.budgetMax,
    budgetType: input.budgetType,
    deadline: input.deadline,
    skills: input.skills,
    status: "open",
    expiresAt: jobExpiry(now.getTime()),
    createdAt: now,
    updatedAt: now,
  });
  return { id };
}

/** Egasi (yoki admin — faqat yopish) uchun e'lonni yuklash */
async function loadOwnedJob(session: SessionPayload, id: string, opts: { allowAdmin?: boolean } = {}) {
  const job = await getJobRow(id);
  if (!job) throw new ApiError(404, "E'lon topilmadi");
  const isOwner = job.clientId === session.sub;
  if (!isOwner && !(opts.allowAdmin && session.role === "admin")) throw new ApiError(403, "Bu e'lon sizniki emas");
  return { job, isOwner };
}

export async function editJob(session: SessionPayload, id: string, input: JobInput) {
  const { job } = await loadOwnedJob(session, id);
  if (job.status === "hired") throw new ApiError(400, "Mutaxassis tanlangan e'lonni tahrirlab bo'lmaydi");
  await db
    .update(jobs)
    .set({
      title: input.title,
      description: input.description,
      category: input.category,
      regionSlug: input.regionSlug,
      budgetMin: input.budgetMin,
      budgetMax: input.budgetMax,
      budgetType: input.budgetType,
      deadline: input.deadline,
      skills: input.skills,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, id));
  return { id, status: job.status };
}

/** Yopish (egasi yoki admin) / qayta ochish (egasi; muddat yana JOB_TTL_DAYS kunga uzayadi) */
export async function setJobOpen(session: SessionPayload, id: string, open: boolean, req?: Request) {
  const { job, isOwner } = await loadOwnedJob(session, id, { allowAdmin: !open });
  if (job.status === "hired") throw new ApiError(400, "Mutaxassis tanlangan — e'lon holatini o'zgartirib bo'lmaydi");
  const now = new Date();
  if (open) {
    if (job.status === "open" && (!job.expiresAt || job.expiresAt > now)) return { id, status: "open" as const, expiresAt: job.expiresAt };
    const expiresAt = jobExpiry(now.getTime());
    await db.update(jobs).set({ status: "open", expiresAt, updatedAt: now }).where(and(eq(jobs.id, id), ne(jobs.status, "hired")));
    return { id, status: "open" as const, expiresAt };
  }
  if (job.status === "closed") return { id, status: "closed" as const, expiresAt: job.expiresAt };
  await db.update(jobs).set({ status: "closed", updatedAt: now }).where(and(eq(jobs.id, id), eq(jobs.status, "open")));
  if (!isOwner) {
    await audit(session.sub, "admin_job_closed", { targetType: "job", targetId: id, meta: { title: job.title } }, req);
    await notifyJob(job.clientId, "job_expired", "E'loningiz moderator tomonidan yopildi", `«${job.title}» — savollar bo'lsa qo'llab-quvvatlash xizmatiga yozing.`, "/kabinet/elonlar");
  }
  return { id, status: "closed" as const, expiresAt: job.expiresAt };
}

/* ------------------------------------------------------------------ */
/* Takliflar                                                           */
/* ------------------------------------------------------------------ */
/** Taklif yuborishga tayyor mutaxassis: rol, profil va obuna (canReceiveOrders) */
async function requireProposingSpecialist(session: SessionPayload) {
  if (session.role !== "specialist" && session.role !== "admin") throw new ApiError(403, "Taklifni faqat mutaxassislar yuboradi");
  const sp = await specialistForUser(session.sub);
  if (!sp) throw new ApiError(403, "Avval mutaxassis profilingizni to'ldiring");
  return sp;
}

export async function createProposal(session: SessionPayload, input: ProposalInput) {
  const sp = await requireProposingSpecialist(session);
  const [job, settings] = await Promise.all([getJobRow(input.jobId), getSettings()]);
  if (!job || job.client.isBanned) throw new ApiError(404, "E'lon topilmadi");
  if (job.clientId === session.sub) throw new ApiError(400, "O'z e'loningizga taklif yubora olmaysiz");
  const now = Date.now();
  if (job.status !== "open" || (job.expiresAt && job.expiresAt.getTime() <= now)) throw new ApiError(400, "E'lon yopilgan — taklif qabul qilinmaydi");
  if (!canReceiveOrders(sp, settings, new Date(now))) {
    throw new ApiError(403, SUBSCRIPTION_INACTIVE, { subscription: SUBSCRIPTION_HREF });
  }
  if (input.amount < settings.minOrderAmount) {
    throw new ApiError(422, "Summa juda kichik", { amount: `Kamida ${formatPrice(settings.minOrderAmount)}` });
  }

  const existing = await db.query.proposals.findFirst({
    where: and(eq(proposals.jobId, job.id), eq(proposals.specialistId, sp.id)),
    columns: { id: true, status: true },
  });
  if (existing && existing.status !== "withdrawn") throw new ApiError(409, "Bu e'longa allaqachon taklif yuborgansiz");

  const sent = await proposalsSentToday(sp.id, now);
  if (sent >= PROPOSAL_DAILY_LIMIT) {
    throw new ApiError(429, `Bugungi limit tugadi: kuniga ${PROPOSAL_DAILY_LIMIT} ta taklif. Ertaga yana yuborishingiz mumkin`);
  }

  const at = new Date(now);
  let id: string;
  if (existing) {
    // Qaytarib olingan taklif qayta yuboriladi (yagona indeks: bitta e'longa bitta taklif)
    id = existing.id;
    await db
      .update(proposals)
      .set({ status: "pending", amount: input.amount, deliveryDays: input.deliveryDays, coverLetter: input.coverLetter, orderId: null, createdAt: at, updatedAt: at })
      .where(and(eq(proposals.id, id), eq(proposals.status, "withdrawn")));
  } else {
    id = uid();
    try {
      await db.insert(proposals).values({
        id,
        jobId: job.id,
        specialistId: sp.id,
        coverLetter: input.coverLetter,
        amount: input.amount,
        deliveryDays: input.deliveryDays,
        status: "pending",
        createdAt: at,
        updatedAt: at,
      });
    } catch (e) {
      // Parallel ikki so'rov: yagona indeks (job, specialist) ikkinchisini to'xtatadi
      if (String(e).includes("UNIQUE")) throw new ApiError(409, "Bu e'longa allaqachon taklif yuborgansiz");
      throw e;
    }
  }
  await syncProposalsCount(job.id);

  await notifyJob(
    job.clientId,
    "proposal_new",
    `Yangi taklif: ${job.title}`.slice(0, 160),
    `${session.name} — ${formatPrice(input.amount)}, ${input.deliveryDays} kunda. Takliflarni solishtirib, mosini tanlang.`,
    jobHref(job.id),
  );
  return { id, remaining: Math.max(0, PROPOSAL_DAILY_LIMIT - sent - 1) };
}

/** Taklif + e'lon (egalikni tekshirish uchun) */
async function loadProposal(id: string) {
  const p = await db.query.proposals.findFirst({
    where: eq(proposals.id, id),
    with: {
      job: { columns: { id: true, clientId: true, title: true, description: true, status: true, deadline: true } },
      specialist: {
        columns: { id: true, userId: true, createdAt: true, subscriptionUntil: true, completedCount: true, topRated: true },
        with: { user: { columns: { name: true, isBanned: true } } },
      },
    },
  });
  if (!p) throw new ApiError(404, "Taklif topilmadi");
  return p;
}

/** Muallif: taklifni qaytarib olish (ko'rib chiqilayotgan yoki saralangan) */
export async function withdrawProposal(session: SessionPayload, id: string) {
  const p = await loadProposal(id);
  const sp = await specialistForUser(session.sub);
  if (!sp || sp.id !== p.specialistId) throw new ApiError(403, "Bu taklif sizniki emas");
  if (p.status !== "pending" && p.status !== "shortlisted") throw new ApiError(400, "Bu taklifni endi qaytarib bo'lmaydi");
  const res = await db
    .update(proposals)
    .set({ status: "withdrawn", updatedAt: new Date() })
    .where(and(eq(proposals.id, id), inArray(proposals.status, ["pending", "shortlisted"])));
  if (!res.rowsAffected) throw new ApiError(409, "Taklif holati o'zgargan — sahifani yangilang");
  await syncProposalsCount(p.jobId);
  return { id, status: "withdrawn" as const };
}

/** E'lon egasi: saralash yoki rad etish */
export async function reviewProposal(session: SessionPayload, id: string, action: "shortlist" | "decline") {
  const p = await loadProposal(id);
  if (p.job.clientId !== session.sub) throw new ApiError(403, "Bu e'lon sizniki emas");
  const from = action === "shortlist" ? (["pending"] as const) : (["pending", "shortlisted"] as const);
  if (!(from as readonly string[]).includes(p.status)) {
    throw new ApiError(400, action === "shortlist" ? "Faqat ko'rib chiqilayotgan taklifni saralash mumkin" : "Bu taklifni rad etib bo'lmaydi");
  }
  const to = action === "shortlist" ? "shortlisted" : "declined";
  const res = await db
    .update(proposals)
    .set({ status: to, updatedAt: new Date() })
    .where(and(eq(proposals.id, id), inArray(proposals.status, [...from])));
  if (!res.rowsAffected) throw new ApiError(409, "Taklif holati o'zgargan — sahifani yangilang");
  if (action === "decline") {
    await notifyJob(p.specialist.userId, "proposal_declined", `Taklifingiz rad etildi: ${p.job.title}`.slice(0, 160), "Mijoz boshqa mutaxassisni tanladi yoki taklif mos kelmadi. Boshqa e'lonlarni ko'rib chiqing.", "/kabinet/takliflar");
  } else {
    // Saralanganda ham mutaxassis bilsin — mijoz tez orada qaror qiladi
    await notify(p.specialist.userId, "proposal_shortlisted", `Taklifingiz saralandi: ${p.job.title}`.slice(0, 160), "Mijoz taklifingizni qisqa ro'yxatga oldi. Savol bo'lsa e'lon sahifasida javob bering.", jobHref(p.jobId));
  }
  return { id, status: to };
}

/** YYYY-MM-DD (Toshkent) + n kun */
function dueDateIn(days: number, now = Date.now()): string {
  return tashkentNow(now + days * DAY).date;
}

/**
 * E'lon egasi taklifni qabul qiladi (bitta tranzaksiya):
 *  buyurtma yaratiladi (accepted, narx = taklif summasi, to'lov kutilmoqda, komissiya darajasi snapshot),
 *  taklif → accepted (+orderId), qolgan faol takliflar → declined, e'lon → hired (+hiredOrderId).
 * Mutaxassis obunasi faol bo'lmasa (canReceiveOrders) — 403: yangi buyurtma ololmaydi.
 */
export async function acceptProposal(session: SessionPayload, id: string, contactPhone: string | undefined, req?: Request) {
  const p = await loadProposal(id);
  if (p.job.clientId !== session.sub) throw new ApiError(403, "Bu e'lon sizniki emas");
  if (p.status !== "pending" && p.status !== "shortlisted") throw new ApiError(400, "Bu taklifni qabul qilib bo'lmaydi");
  if (p.job.status !== "open") throw new ApiError(400, "E'lon yopilgan yoki mutaxassis allaqachon tanlangan");
  if (p.specialist.user.isBanned) throw new ApiError(400, "Mutaxassis hisobi bloklangan — boshqa taklifni tanlang");
  if (p.specialist.userId === session.sub) throw new ApiError(400, "O'zingizni yollay olmaysiz");

  const settings = await getSettings();
  if (!canReceiveOrders(p.specialist, settings)) {
    throw new ApiError(403, "Mutaxassis obunasi faol emas — hozircha yangi buyurtma qabul qila olmaydi. Boshqa taklifni tanlang");
  }
  const client = await db.query.users.findFirst({ where: eq(users.id, session.sub), columns: { phone: true, name: true } });
  const phone = (contactPhone && contactPhone.trim()) || client?.phone || "";
  if (!phone) throw new ApiError(422, "Telefon raqamini kiriting", { contactPhone: "Mutaxassis siz bilan bog'lanishi uchun telefon kerak" });

  const { pct, tier } = commissionPctFor(settings, p.specialist);
  const orderId = uid();
  const now = new Date();
  const declinedIds = await db.transaction(async (tx) => {
    const jobRes = await tx
      .update(jobs)
      .set({ status: "hired", hiredOrderId: orderId, updatedAt: now })
      .where(and(eq(jobs.id, p.jobId), eq(jobs.status, "open")));
    if (!jobRes.rowsAffected) throw new ApiError(409, "E'lon holati o'zgargan — sahifani yangilang");
    const propRes = await tx
      .update(proposals)
      .set({ status: "accepted", orderId, updatedAt: now })
      .where(and(eq(proposals.id, id), inArray(proposals.status, ["pending", "shortlisted"])));
    if (!propRes.rowsAffected) throw new ApiError(409, "Taklif holati o'zgargan — sahifani yangilang");
    await tx.insert(orders).values({
      id: orderId,
      clientId: session.sub,
      specialistId: p.specialistId,
      title: p.job.title.slice(0, 120),
      description: p.job.description,
      budget: p.amount,
      deadline: p.job.deadline,
      contactPhone: phone,
      status: "accepted",
      amount: p.amount,
      paymentState: "awaiting",
      commissionPct: pct,
      dueDate: dueDateIn(p.deliveryDays, now.getTime()),
      jobId: p.jobId,
      proposalId: id,
      createdAt: now,
      updatedAt: now,
    });
    const others = await tx
      .select({ id: proposals.id, userId: specialists.userId })
      .from(proposals)
      .innerJoin(specialists, eq(specialists.id, proposals.specialistId))
      .where(and(eq(proposals.jobId, p.jobId), ne(proposals.id, id), inArray(proposals.status, ["pending", "shortlisted"])));
    if (others.length) {
      await tx
        .update(proposals)
        .set({ status: "declined", updatedAt: now })
        .where(inArray(
          proposals.id,
          others.map((o) => o.id),
        ));
    }
    return others;
  });
  await syncProposalsCount(p.jobId);

  await recordOrderEvent(orderId, session.sub, "status", { toStatus: "accepted", note: "E'lon orqali: mijoz taklifni qabul qildi" });
  await recordOrderEvent(orderId, session.sub, "amount", { note: `Narx belgilandi: ${formatPrice(p.amount)} (komissiya ${pct}%)` });
  await audit(session.sub, "proposal_accepted", { targetType: "order", targetId: orderId, meta: { jobId: p.jobId, proposalId: id, amount: p.amount, commissionPct: pct, tier } }, req);

  await notifyJob(
    p.specialist.userId,
    "proposal_accepted",
    `Taklifingiz qabul qilindi: ${p.job.title}`.slice(0, 160),
    `${client?.name ?? session.name} sizni tanladi — ${formatPrice(p.amount)}, ${p.deliveryDays} kun. Mijoz to'lovni eskrouga o'tkazgach ishni boshlang.`,
    orderHref(orderId),
  );
  await notify(
    session.sub,
    "order_amount",
    `Buyurtma yaratildi: ${formatPrice(p.amount)}`,
    `«${p.job.title}» — ${p.specialist.user.name} bilan. To'lov eskrouda saqlanadi va ishni qabul qilganingizdan keyin mutaxassisga o'tadi.`,
    orderHref(orderId),
  );
  await Promise.all(
    declinedIds.map((o) =>
      notifyJob(o.userId, "proposal_declined", `Taklifingiz rad etildi: ${p.job.title}`.slice(0, 160), "Mijoz boshqa mutaxassisni tanladi. Boshqa e'lonlarni ko'rib chiqing.", "/kabinet/takliflar"),
    ),
  );
  return { id, status: "accepted" as const, orderId, href: orderHref(orderId) };
}

/* ------------------------------------------------------------------ */
/* Cron                                                                */
/* ------------------------------------------------------------------ */
/**
 * Kunlik cron: muddati o'tgan ochiq e'lonlar → closed, egasiga bildirishnoma (job_expired).
 * Qaytaradi: yopilganlar soni. Xato tashlamaydi — cron'ning boshqa qadamlarini to'xtatmasin.
 */
export async function closeExpiredJobs(now = Date.now()): Promise<number> {
  try {
    const expired = await findExpiredOpenJobs(now);
    let closed = 0;
    for (const j of expired) {
      const res = await db
        .update(jobs)
        .set({ status: "closed", updatedAt: new Date(now) })
        .where(and(eq(jobs.id, j.id), eq(jobs.status, "open")));
      if (!res.rowsAffected) continue;
      closed += 1;
      await notifyJob(
        j.clientId,
        "job_expired",
        `E'lon muddati tugadi: ${j.title}`.slice(0, 160),
        `${JOB_TTL_DAYS} kun o'tgani uchun e'lon avtomatik yopildi. Hali kerak bo'lsa — kabinetdan qayta oching.`,
        "/kabinet/elonlar",
      );
    }
    return closed;
  } catch (e) {
    console.error("[jobs] closeExpiredJobs", e);
    return 0;
  }
}
