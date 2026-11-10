import "server-only";
import { and, eq, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { postComments, posts, reports, reviews, specialists, users } from "@/lib/db/schema";
import { notify, notifyAdmins } from "@/lib/notifications";

/**
 * MODERATSIYA — shikoyatlar bo'yicha avtomatik yashirish (2026-11-04).
 * Post / izoh / sharh bo'yicha kamida AUTO_HIDE_REPORTS ta TURLI foydalanuvchidan OCHIQ shikoyat kelsa,
 * nishon `hidden_by_reports = true` bilan vaqtincha yashiriladi: lenta/profil/reels/qidiruv/izoh ro'yxatida chiqmaydi,
 * egasi va admin ko'radi (UI'da «Shikoyatlar sababli vaqtincha yashirildi» belgisi).
 * Admin shikoyatni o'chirmasdan YOPSA (navbat yoki Telegram boti) — nishon qaytariladi (`restoreIfNoOpenReports`).
 * O'z-o'ziga shikoyat qilish API'da taqiqlangan, shuning uchun bu yerda alohida sanalmaydi; baribir muallif chiqarib tashlanadi.
 */
export const AUTO_HIDE_REPORTS = 3;
/** Shikoyati avto-yashirishga sanalishi uchun shikoyatchi hisobining eng kam yoshi */
export const REPORTER_MIN_AGE_MS = 3 * 24 * 60 * 60 * 1000;

export type AutoHideTarget = "post" | "comment" | "review";

type Viewer = { id: string; role: string } | null;

/** Lenta/profil/reels/qidiruv sharti: yashirilgan post faqat muallifi va adminga ko'rinadi */
export function postNotHiddenCondition(viewer: Viewer): SQL {
  if (viewer?.role === "admin") return sql`1 = 1`;
  if (viewer) return or(eq(posts.hiddenByReports, false), eq(posts.authorId, viewer.id))!;
  return eq(posts.hiddenByReports, false);
}

/** Izoh ro'yxati sharti: yashirilgan izoh faqat muallifi va adminga */
export function commentNotHiddenCondition(viewer: Viewer): SQL {
  if (viewer?.role === "admin") return sql`1 = 1`;
  if (viewer) return or(eq(postComments.hiddenByReports, false), eq(postComments.authorId, viewer.id))!;
  return eq(postComments.hiddenByReports, false);
}

/** Nishon bo'yicha ochiq shikoyatlarda nechta turli shikoyatchi bor (muallifning o'zi sanalmaydi) */
async function distinctOpenReporters(targetType: AutoHideTarget, targetId: string, authorId: string): Promise<number> {
  // Faqat «yetilgan» hisoblar sanaladi (REPORTER_MIN_AGE_MS, bloklanmagan): bir kunda ochilgan uchta soxta hisob bilan
  // begona postni lentadan yo'qotib bo'lmasin (7-audit — ommaviy shikoyat bilan jim qilish)
  const aged = Date.now() - REPORTER_MIN_AGE_MS;
  const [row] = await db
    .select({ n: sql<number>`count(distinct ${reports.reporterId})` })
    .from(reports)
    .innerJoin(users, eq(users.id, reports.reporterId))
    .where(and(eq(reports.targetType, targetType), eq(reports.targetId, targetId), eq(reports.status, "open"), sql`${reports.reporterId} != ${authorId}`, eq(users.isBanned, false), sql`${users.createdAt} <= ${aged}`));
  return Number(row?.n ?? 0);
}

async function targetMeta(targetType: AutoHideTarget, targetId: string): Promise<{ authorId: string; hidden: boolean; href: string } | null> {
  if (targetType === "post") {
    const p = await db.query.posts.findFirst({ where: eq(posts.id, targetId), columns: { authorId: true, hiddenByReports: true, groupId: true } });
    return p ? { authorId: p.authorId, hidden: p.hiddenByReports, href: `/?post=${targetId}` } : null;
  }
  if (targetType === "comment") {
    const c = await db.query.postComments.findFirst({ where: eq(postComments.id, targetId), columns: { authorId: true, hiddenByReports: true, postId: true } });
    return c ? { authorId: c.authorId, hidden: c.hiddenByReports, href: `/?post=${c.postId}` } : null;
  }
  const r = await db.query.reviews.findFirst({ where: eq(reviews.id, targetId), columns: { authorId: true, hiddenByReports: true, specialistId: true } });
  if (!r) return null;
  const sp = await db.query.specialists.findFirst({ where: eq(specialists.id, r.specialistId), columns: { slug: true } });
  return { authorId: r.authorId, hidden: r.hiddenByReports, href: sp ? `/mutaxassislar/${sp.slug}#sharhlar` : "/" };
}

async function setHidden(targetType: AutoHideTarget, targetId: string, hidden: boolean): Promise<void> {
  if (targetType === "post") await db.update(posts).set({ hiddenByReports: hidden }).where(eq(posts.id, targetId));
  else if (targetType === "comment") await db.update(postComments).set({ hiddenByReports: hidden }).where(eq(postComments.id, targetId));
  else await db.update(reviews).set({ hiddenByReports: hidden }).where(eq(reviews.id, targetId));
}

/** Sharh yashirilsa/qaytarilsa mutaxassis reytingi qayta hisoblanadi (recalcRating yashirinlarni sanamaydi) */
async function recalcReview(reviewId: string): Promise<void> {
  const r = await db.query.reviews.findFirst({ where: eq(reviews.id, reviewId), columns: { specialistId: true } });
  if (!r) return;
  const { recalcRating } = await import("@/lib/queries");
  await recalcRating(r.specialistId).catch(() => undefined);
}

const LABEL: Record<AutoHideTarget, string> = { post: "Postingiz", comment: "Izohingiz", review: "Sharhingiz" };
const ADMIN_LABEL: Record<AutoHideTarget, string> = { post: "Post", comment: "Izoh", review: "Sharh" };

/**
 * Yangi shikoyatdan keyin chaqiriladi: chegara oshgan bo'lsa nishonni yashiradi, muallifga bir marta xabar beradi
 * va adminlarga ogohlantirish yuboradi. Qaytaradi: hozir yashirildimi.
 */
export async function maybeAutoHide(targetType: AutoHideTarget, targetId: string): Promise<boolean> {
  // SHARH avtomatik yashirilmaydi (7-audit): yashirish reytingni o'zgartiradi — mutaxassis yordamchi hisoblar bilan o'ziga
  // yozilgan yomon sharhni, raqib esa yaxshi sharhni «shikoyat» orqali yo'qotib qo'ya olardi. Sharh bo'yicha qarorni faqat
  // admin chiqaradi (har shikoyat adminlarga alohida xabar bo'lib boradi). Ilgari yashirilganlari admin yopganda qaytadi.
  if (targetType === "review") return false;
  const meta = await targetMeta(targetType, targetId);
  if (!meta || meta.hidden) return false;
  const n = await distinctOpenReporters(targetType, targetId, meta.authorId);
  if (n < AUTO_HIDE_REPORTS) return false;
  // CAS: faqat hali yashirilmagan qator — ikki parallel shikoyat ikki marta xabar yubormasin
  const res =
    targetType === "post"
      ? await db.update(posts).set({ hiddenByReports: true }).where(and(eq(posts.id, targetId), eq(posts.hiddenByReports, false)))
      : await db.update(postComments).set({ hiddenByReports: true }).where(and(eq(postComments.id, targetId), eq(postComments.hiddenByReports, false)));
  if (res.rowsAffected === 0) return false;
  await notify(meta.authorId, "account", `${LABEL[targetType]} vaqtincha yashirildi`, `${LABEL[targetType]} bir nechta shikoyat sababli vaqtincha yashirildi — admin ko'rib chiqadi. Qoidabuzarlik bo'lmasa, qaytariladi.`, meta.href).catch(() => undefined);
  await notifyAdmins("report", `${ADMIN_LABEL[targetType]} avtomatik yashirildi (${n} ta shikoyat)`, "Navbatda ko'rib chiqing: shikoyatni yopsangiz — qaytadi, o'chirsangiz — yo'qoladi.", "/admin#shikoyatlar", { skipMail: true }).catch(() => undefined);
  return true;
}

/** Admin shikoyatni (o'chirmasdan) yopganda: shu nishon bo'yicha ochiq shikoyat qolmagan bo'lsa yashirin belgini olib tashlaydi */
export async function restoreIfNoOpenReports(targetType: string, targetId: string): Promise<boolean> {
  if (targetType !== "post" && targetType !== "comment" && targetType !== "review") return false;
  const meta = await targetMeta(targetType, targetId);
  if (!meta || !meta.hidden) return false;
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(reports).where(and(eq(reports.targetType, targetType), eq(reports.targetId, targetId), eq(reports.status, "open")));
  if (Number(row?.n ?? 0) > 0) return false;
  await setHidden(targetType, targetId, false);
  if (targetType === "review") await recalcReview(targetId);
  await notify(meta.authorId, "account", `${LABEL[targetType]} qaytarildi`, `Admin shikoyatlarni ko'rib chiqdi — ${LABEL[targetType].toLowerCase()} yana ko'rinadi.`, meta.href).catch(() => undefined);
  return true;
}
