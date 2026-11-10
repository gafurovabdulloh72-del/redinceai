import "server-only";
import { and, eq, gt, inArray, isNull, ne, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  applications,
  botSessions,
  challengeEntries,
  challenges,
  closeFriends,
  collections,
  courses,
  dmFolders,
  enrollments,
  followRequests,
  follows,
  groupMembers,
  groups,
  loginRequests,
  mentorEarnings,
  mentorPayouts,
  mentors,
  postSaves,
  posts,
  pushSubscriptions,
  resumes,
  scheduledPosts,
  stories,
  storyHighlights,
  userBlocks,
  vacancies,
  watchLater,
} from "@/lib/db/schema";

/**
 * HISOBNI O'CHIRISH — ijtimoiy tarmoq qismi (7-audit, 2026-11-10).
 *
 * Hisob QATORI o'chirilmaydi (buyurtma/to'lov daftari unga bog'langan) — u anonimlashtiriladi, shuning uchun bazadagi
 * `ON DELETE CASCADE` ISHLAMAYDI va hamma narsa qo'lda tozalanadi. Ilgari o'chirish faqat marketpleys davridagi
 * ma'lumotlarni (profil, portfolio, sevimlilar) tozalardi; ijtimoiy tarmoq qo'shilgach quyidagilar qolib ketardi:
 * profil postlari va story'lar, ommaviy rezyume (kontakt havolalari bilan), yuborilgan arizalar, obunalar, push
 * obunalari (qurilmaga bildirishnoma kelaverardi), jamoa a'zoliklari.
 *
 * Saqlanadi (ataylab): jamoadagi post/xabarlar, izohlar, savol-javoblar va DM yozishmalari — ular boshqa odamlarning
 * suhbatiga tegishli, muallif «O'chirilgan foydalanuvchi» bo'lib ko'rinadi; yakunlangan konkursdagi ishtirok (g'oliblar tarixi).
 *
 * Hisoblagichlar (denormalizatsiya) qo'lda to'g'rilanadi: vakansiya arizalari soni, jamoa a'zolari soni, konkurs ishtiroklari.
 * Har qadam alohida — bittasi yiqilsa qolganlari bajariladi (o'chirish yarim yo'lda to'xtab qolmasin); xatolar natijada qaytadi.
 */
export async function purgeAccountData(userId: string, telegramChatId: string | null): Promise<{ done: string[]; failed: string[] }> {
  const done: string[] = [];
  const failed: string[] = [];
  const step = async (name: string, run: () => Promise<unknown>) => {
    try {
      await run();
      done.push(name);
    } catch (e) {
      failed.push(name);
      console.error(`[account-purge] ${name}`, e);
    }
  };
  const now = new Date();

  // Qurilmalarga bildirishnoma kelmasin
  await step("push", () => db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId)));

  // Aloqalar: obunalar (ikki tomon), so'rovlar, yaqin do'stlar, bloklar
  await step("follows", () => db.delete(follows).where(or(eq(follows.followerId, userId), eq(follows.followingId, userId))));
  await step("followRequests", () => db.delete(followRequests).where(or(eq(followRequests.fromUserId, userId), eq(followRequests.toUserId, userId))));
  await step("closeFriends", () => db.delete(closeFriends).where(or(eq(closeFriends.ownerId, userId), eq(closeFriends.friendId, userId))));
  await step("blocks", () => db.delete(userBlocks).where(eq(userBlocks.blockerId, userId)));

  // Konkurs: OCHIQ konkursdagi ishtirok olib tashlanadi (hisoblagich bilan); yakunlanganlari — tarix, qoladi
  await step("challengeEntries", async () => {
    const open = await db
      .select({ entryId: challengeEntries.id, challengeId: challengeEntries.challengeId })
      .from(challengeEntries)
      .innerJoin(challenges, eq(challenges.id, challengeEntries.challengeId))
      .where(and(eq(challengeEntries.userId, userId), isNull(challenges.winnerEntryId), gt(challenges.endsAt, now)));
    for (const e of open) {
      await db.transaction(async (tx) => {
        const res = await tx.delete(challengeEntries).where(eq(challengeEntries.id, e.entryId));
        if ((res.rowsAffected ?? 0) > 0) await tx.update(challenges).set({ entriesCount: sql`max(${challenges.entriesCount} - 1, 0)` }).where(eq(challenges.id, e.challengeId));
      });
    }
  });

  // Kontent: story'lar (+saqlangan to'plamlar), profil postlari, rejalashtirilgan postlar
  await step("stories", () => db.delete(stories).where(eq(stories.authorId, userId)));
  await step("highlights", () => db.delete(storyHighlights).where(eq(storyHighlights.ownerId, userId)));
  await step("scheduledPosts", () => db.delete(scheduledPosts).where(eq(scheduledPosts.authorId, userId)));
  await step("profilePosts", () => {
    // Yakunlangan konkursda qolgan ishtirok postga bog'langan — o'sha postlar tarix sifatida saqlanadi
    const kept = db.select({ id: challengeEntries.postId }).from(challengeEntries).where(eq(challengeEntries.userId, userId));
    return db.delete(posts).where(and(eq(posts.authorId, userId), isNull(posts.groupId), notInArray(posts.id, kept)));
  });

  // Shaxsiy kutubxona
  await step("saves", () => db.delete(postSaves).where(eq(postSaves.userId, userId)));
  await step("watchLater", () => db.delete(watchLater).where(eq(watchLater.userId, userId)));
  await step("collections", () => db.delete(collections).where(eq(collections.ownerId, userId)));
  await step("dmFolders", () => db.delete(dmFolders).where(eq(dmFolders.userId, userId)));

  // Ish bozori: rezyume (kontakt havolalari bor), yuborilgan arizalar (hisoblagich bilan), o'z vakansiyalari yopiladi
  await step("resume", () => db.delete(resumes).where(eq(resumes.userId, userId)));
  await step("applications", () =>
    db.transaction(async (tx) => {
      const mine = tx.select({ id: applications.vacancyId }).from(applications).where(eq(applications.userId, userId));
      await tx.update(vacancies).set({ applicationsCount: sql`max(${vacancies.applicationsCount} - 1, 0)` }).where(inArray(vacancies.id, mine));
      await tx.delete(applications).where(eq(applications.userId, userId));
    }),
  );
  await step("vacancies", () => db.update(vacancies).set({ status: "closed" }).where(and(eq(vacancies.authorId, userId), eq(vacancies.status, "open"))));

  // Jamoalar: a'zolik olib tashlanadi (egasi bo'lgan jamoalar qoladi — ularni sayt adminlari boshqaradi)
  await step("memberships", () =>
    db.transaction(async (tx) => {
      const active = tx
        .select({ id: groupMembers.groupId })
        .from(groupMembers)
        .where(and(eq(groupMembers.userId, userId), eq(groupMembers.status, "active"), ne(groupMembers.role, "owner")));
      await tx.update(groups).set({ membersCount: sql`max(${groups.membersCount} - 1, 0)` }).where(inArray(groups.id, active));
      await tx.delete(groupMembers).where(and(eq(groupMembers.userId, userId), ne(groupMembers.role, "owner")));
    }),
  );

  // Ustozlik: o'quvchisiz ustoz sahifasi yopiladi (o'quvchisi/hisob-kitobi bor ustoz bu yergacha kelmaydi — `mentorBlocksDeletion`)
  await step("mentor", async () => {
    const m = await db.query.mentors.findFirst({ where: eq(mentors.userId, userId), columns: { id: true } });
    if (!m) return;
    await db.update(courses).set({ isPublished: false }).where(eq(courses.mentorId, m.id));
    await db.update(mentors).set({ isApproved: false }).where(eq(mentors.id, m.id));
  });

  // Telegram: kutilayotgan kirish so'rovlari va bot suhbati holati
  if (telegramChatId) {
    await step("telegram", async () => {
      await db.delete(loginRequests).where(eq(loginRequests.telegramChatId, telegramChatId));
      await db.delete(botSessions).where(eq(botSessions.chatId, telegramChatId));
    });
  }
  return { done, failed };
}

/**
 * Ustoz hisobini o'zi o'chira olmaydigan holat: kursida o'quvchilar bor yoki hisob-kitob tugamagan (kutilayotgan/mavjud
 * daromad, ochiq yechish so'rovi). Bunday hisob o'chsa — pul to'lagan o'quvchilar darsdan, ustoz esa pulidan ayrilardi.
 */
export async function mentorBlocksDeletion(userId: string): Promise<boolean> {
  const m = await db.query.mentors.findFirst({ where: eq(mentors.userId, userId), columns: { id: true } });
  if (!m) return false;
  const [student] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .where(and(eq(courses.mentorId, m.id), ne(enrollments.userId, userId)))
    .limit(1);
  if (student) return true;
  const [money] = await db
    .select({ id: mentorEarnings.id })
    .from(mentorEarnings)
    .where(and(eq(mentorEarnings.mentorId, m.id), inArray(mentorEarnings.status, ["pending", "available"])))
    .limit(1);
  if (money) return true;
  const [payout] = await db
    .select({ id: mentorPayouts.id })
    .from(mentorPayouts)
    .where(and(eq(mentorPayouts.mentorId, m.id), eq(mentorPayouts.status, "requested")))
    .limit(1);
  return Boolean(payout);
}
