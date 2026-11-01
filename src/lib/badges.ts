import "server-only";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { challengeEntries, challenges, follows, mentors, questionAnswers, questions, topAwards } from "@/lib/db/schema";
import type { Locale } from "@/lib/i18n";

/**
 * BELGILAR (2026-11-01, KEYINGI-REJA 7): ijodkor profilidagi yutuq belgilari.
 * Hammasi MAVJUD ma'lumotdan hisoblanadi (alohida jadval yo'q): oylik TOP g'oliblari
 * (top_awards), konkurs g'olibi (challenges.winnerEntryId), tasdiqlangan ustoz (mentors),
 * obunachi bosqichi (follows) va maslahatda «Eng foydali» javoblar (questions.acceptedAnswerId).
 * Yangi belgi qo'shsangiz shu faylga yozing — UI o'zi chizadi (BadgeRow).
 */

export type CreatorBadgeKey = "monthly_top" | "contest_winner" | "mentor" | "followers" | "advisor";

export interface CreatorBadge {
  key: CreatorBadgeKey;
  /** lucide ikonka nomi — components/profile/CreatorBadges xaritasida */
  label: string;
  hint: string;
}

const FOLLOWER_STEPS = [1000, 500, 100] as const;

export async function creatorBadges(userId: string, til: Locale = "uz"): Promise<CreatorBadge[]> {
  const t = (uz: string, ru: string) => (til === "ru" ? ru : uz);
  const [awards, contestWins, mentorRow, followers, bestAnswers] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(topAwards).where(and(eq(topAwards.userId, userId), eq(topAwards.rank, 1))),
    db
      .select({ n: sql<number>`count(*)` })
      .from(challenges)
      .innerJoin(challengeEntries, eq(challengeEntries.id, challenges.winnerEntryId))
      .where(eq(challengeEntries.userId, userId)),
    db.query.mentors.findFirst({ where: and(eq(mentors.userId, userId), eq(mentors.isApproved, true)), columns: { id: true } }),
    db.select({ n: sql<number>`count(*)` }).from(follows).where(eq(follows.followingId, userId)),
    db
      .select({ n: sql<number>`count(*)` })
      .from(questions)
      .innerJoin(questionAnswers, eq(questionAnswers.id, questions.acceptedAnswerId))
      .where(and(isNotNull(questions.acceptedAnswerId), eq(questionAnswers.userId, userId))),
  ]);
  const out: CreatorBadge[] = [];
  const topWins = Number(awards[0]?.n ?? 0);
  if (topWins > 0) {
    out.push({
      key: "monthly_top",
      label: topWins > 1 ? t(`Oy g'olibi ×${topWins}`, `Лучший месяца ×${topWins}`) : t("Oy g'olibi", "Лучший месяца"),
      hint: t("Oylik TOP reytingda 1-o'rin", "1-е место в ТОП рейтинге месяца"),
    });
  }
  const wins = Number(contestWins[0]?.n ?? 0);
  if (wins > 0) {
    out.push({
      key: "contest_winner",
      label: wins > 1 ? t(`Konkurs g'olibi ×${wins}`, `Победитель конкурса ×${wins}`) : t("Konkurs g'olibi", "Победитель конкурса"),
      hint: t("Haftalik ijod konkursida g'olib", "Победитель творческого конкурса"),
    });
  }
  if (mentorRow) out.push({ key: "mentor", label: t("Ustoz", "Наставник"), hint: t("Tasdiqlangan mentor — dars beradi", "Подтверждённый ментор") });
  const fc = Number(followers[0]?.n ?? 0);
  const step = FOLLOWER_STEPS.find((s) => fc >= s);
  if (step) out.push({ key: "followers", label: `${step}+ ${t("obunachi", "подписчиков")}`, hint: t(`${fc} ta obunachi`, `${fc} подписчиков`) });
  const best = Number(bestAnswers[0]?.n ?? 0);
  if (best >= 3) {
    out.push({
      key: "advisor",
      label: t("Faol maslahatchi", "Активный советчик"),
      hint: t(`Maslahatda ${best} ta «Eng foydali» javob`, `${best} лучших ответов в разделе советов`),
    });
  }
  return out;
}
