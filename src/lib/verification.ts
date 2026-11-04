import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { orders, portfolioItems, posts, specialists, users } from "@/lib/db/schema";
import { notify, notifyAdmins } from "@/lib/notifications";

/**
 * TASDIQLANGAN PROFIL (ko'k belgi) so'rovi (2026-11-04).
 * Mezonlar server tomonda hisoblanadi: to'liq profil, ≥3 portfolio ishi, ≥1 tugallangan buyurtma yoki ≥1 post,
 * ro'yxatdan ≥7 kun. Hammasi bajarilgach mutaxassis `POST /api/profile/tasdiq` bilan so'rov yuboradi
 * (`specialists.verificationRequestedAt`); admin navbatda tasdiqlaydi (isVerified) yoki rad etadi (verificationNote).
 */
export const VERIFY_MIN_PORTFOLIO = 3;
export const VERIFY_MIN_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

export interface VerificationStatus {
  verified: boolean;
  /** So'rov yuborilgan vaqt (ms); null — so'ralmagan yoki rad etilgan */
  requestedAt: number | null;
  /** Admin rad etish sababi (oxirgi) */
  note: string | null;
  criteria: {
    profile: boolean;
    portfolio: { ok: boolean; n: number };
    activity: boolean;
    age: { ok: boolean; days: number };
  };
  /** Barcha mezonlar bajarilgan */
  eligible: boolean;
}

/** Mutaxassisning tasdiq holati va mezonlari (kabinet kartasi + so'rov tekshiruvi) */
export async function verificationStatus(userId: string): Promise<VerificationStatus | null> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { id: true, avatarUrl: true, createdAt: true }, with: { specialist: { columns: { id: true, bio: true, category: true, regionSlug: true, isVerified: true, verificationRequestedAt: true, verificationNote: true } } } });
  const sp = user?.specialist;
  if (!user || !sp) return null;
  const [pf, done, postN] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(portfolioItems).where(eq(portfolioItems.specialistId, sp.id)).then((r) => Number(r[0]?.n ?? 0)),
    db.select({ n: sql<number>`count(*)` }).from(orders).where(and(eq(orders.specialistId, sp.id), eq(orders.status, "done"))).then((r) => Number(r[0]?.n ?? 0)),
    db.select({ n: sql<number>`count(*)` }).from(posts).where(and(eq(posts.authorId, userId), isNull(posts.groupId))).then((r) => Number(r[0]?.n ?? 0)),
  ]);
  const days = Math.floor((Date.now() - user.createdAt.getTime()) / DAY);
  const criteria: VerificationStatus["criteria"] = {
    profile: Boolean(user.avatarUrl && sp.bio.trim().length >= 40 && sp.category && sp.regionSlug),
    portfolio: { ok: pf >= VERIFY_MIN_PORTFOLIO, n: pf },
    activity: done >= 1 || postN >= 1,
    age: { ok: days >= VERIFY_MIN_DAYS, days },
  };
  return {
    verified: sp.isVerified,
    requestedAt: sp.verificationRequestedAt?.getTime() ?? null,
    note: sp.verificationNote ?? null,
    criteria,
    eligible: criteria.profile && criteria.portfolio.ok && criteria.activity && criteria.age.ok,
  };
}

/** So'rov yuborish: mezonlar bajarilmagan — 422; allaqachon tasdiqlangan — 409; takror — idempotent (vaqt yangilanmaydi) */
export async function requestVerification(userId: string, userName: string): Promise<{ requestedAt: number }> {
  const st = await verificationStatus(userId);
  if (!st) throw new ApiError(404, "Mutaxassis profili topilmadi");
  if (st.verified) throw new ApiError(409, "Profil allaqachon tasdiqlangan");
  if (!st.eligible) throw new ApiError(422, "Avval barcha mezonlarni bajaring");
  if (st.requestedAt) return { requestedAt: st.requestedAt };
  const now = new Date();
  const res = await db
    .update(specialists)
    .set({ verificationRequestedAt: now, verificationNote: null, updatedAt: now })
    .where(and(eq(specialists.userId, userId), eq(specialists.isVerified, false), isNull(specialists.verificationRequestedAt)));
  if (res.rowsAffected === 0) {
    const again = await verificationStatus(userId);
    return { requestedAt: again?.requestedAt ?? now.getTime() };
  }
  await notifyAdmins("account", `Tasdiq so'rovi: ${userName}`, "Mutaxassis ko'k belgi so'radi — navbatda ko'rib chiqing.", "/admin#tasdiqlash", { skipMail: true }).catch(() => undefined);
  return { requestedAt: now.getTime() };
}

/** Admin: so'rovni rad etish — vaqt tozalanadi, sabab saqlanadi, egasiga bildirishnoma */
export async function rejectVerification(specialistId: string, reason: string): Promise<void> {
  const sp = await db.query.specialists.findFirst({ where: eq(specialists.id, specialistId), columns: { userId: true } });
  if (!sp) throw new ApiError(404, "Mutaxassis topilmadi");
  await db.update(specialists).set({ verificationRequestedAt: null, verificationNote: reason, updatedAt: new Date() }).where(eq(specialists.id, specialistId));
  await notify(sp.userId, "account", "Tasdiq so'rovi rad etildi", `Sabab: ${reason}. Kamchiliklarni tuzatib, qayta so'rov yuborishingiz mumkin.`, "/kabinet/profil?tab=mutaxassis#tasdiq").catch(() => undefined);
}
