import { and, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { groupMembers, groups, portfolioItems, type Specialist } from "@/lib/db/schema";
import { profilePostCounts } from "@/lib/profile/posts";
import { isTelegramEnabled, telegramBotUsername } from "@/lib/telegram";
import type { OnboardingStep } from "@/lib/onboarding-shared";

export { ONBOARDING_COOKIE, ONBOARDING_DAYS } from "@/lib/onboarding-shared";
export type { OnboardingKey, OnboardingStep } from "@/lib/onboarding-shared";

/**
 * Yangi ijodkor yo'riqnomasi: «birinchi qadamlar» ro'yxati (rasm → tavsif → portfolio → birinchi post → jamoa → Telegram).
 * Profil to'liqligidan (lib/profile/completeness) farqi: bu — qisqa, tartibli, harakatga undovchi ro'yxat; to'liqlik esa batafsil foiz.
 * Bosh sahifadagi `OnboardingCard` va kunlik/haftalik jamlama (lib/digest.ts) shu hisobdan foydalanadi.
 */
export interface Onboarding {
  steps: OnboardingStep[];
  done: number;
  total: number;
  /** Birinchi bajarilmagan qadam (hammasi bajarilgan bo'lsa — null) */
  next: OnboardingStep | null;
}

/** Tavsif «to'liq» hisoblanadigan uzunlik (profil to'liqligidagi qoida bilan bir xil) */
const BIO_MIN = 60;

interface Source {
  id: string;
  role: string;
  avatarUrl: string | null;
  telegramChatId?: string | null;
  specialist?: Specialist | null;
}

/**
 * Faqat mutaxassisga (rol «mutaxassis» yoki profili bor) hisoblanadi; boshqalarga null. Ro'yxatdan o'tgan, lekin hali
 * profilini saqlamagan mutaxassisning `specialists` qatori yo'q — birinchi qadam aynan shu («Profilingizni yarating»).
 * 3 ta yengil sanash so'rovi (portfolio, postlar, jamoalar) parallel.
 */
export async function creatorOnboarding(user: Source): Promise<Onboarding | null> {
  const sp = user.specialist ?? null;
  if (!sp && user.role !== "specialist") return null;
  const [portfolio, posts, communities] = await Promise.all([
    sp ? db.select({ n: count() }).from(portfolioItems).where(eq(portfolioItems.specialistId, sp.id)).then((r) => r[0]?.n ?? 0) : Promise.resolve(0),
    profilePostCounts(user.id)
      .then((c) => c.posts)
      .catch(() => 0),
    // Rasmiy kanalga hamma avtomatik a'zo — «jamoaga qo'shilish» qadamini u bajarmaydi
    db
      .select({ n: count() })
      .from(groupMembers)
      .innerJoin(groups, eq(groups.id, groupMembers.groupId))
      .where(and(eq(groupMembers.userId, user.id), eq(groupMembers.status, "active"), eq(groups.isOfficial, false)))
      .then((r) => r[0]?.n ?? 0)
      .catch(() => 0),
  ]);

  const steps: OnboardingStep[] = [
    { key: "profile", done: Boolean(sp), href: "/kabinet/profil" },
    { key: "avatar", done: Boolean(user.avatarUrl), href: "/kabinet/profil#rasm" },
    { key: "bio", done: (sp?.bio?.trim().length ?? 0) >= BIO_MIN, href: "/kabinet/profil#bio" },
    { key: "portfolio", done: portfolio >= 1, href: "/kabinet/portfolio" },
    { key: "post", done: posts >= 1, href: "/kabinet/postlar" },
    { key: "community", done: communities >= 1, href: "/jamoalar" },
  ];
  // Telegram qadami faqat bot sozlangan bo'lsa (aks holda ulash imkoni yo'q)
  if (isTelegramEnabled() && telegramBotUsername()) steps.push({ key: "telegram", done: Boolean(user.telegramChatId), href: "/kabinet/profil#telegram" });

  const done = steps.filter((s) => s.done).length;
  return { steps, done, total: steps.length, next: steps.find((s) => !s.done) ?? null };
}
