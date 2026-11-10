import { randomBytes } from "node:crypto";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { favorites, notifications, orders, passwordResets, payments, payouts, portfolioItems, savedSearches, specialists, users } from "@/lib/db/schema";
import { clearSession, getSession, revokeAllSessions, revokeSession } from "@/lib/auth";
import { ApiError, handler, ok, parseBody, requireSession } from "@/lib/api";
import { audit } from "@/lib/security/audit";
import { hashPassword, verifyPassword } from "@/lib/security/password";
import { enforceLimit } from "@/lib/security/rate-limit";
import { mentorBlocksDeletion, purgeAccountData } from "@/lib/account/purge";

const schema = z.object({ password: z.string().min(1, "Parolni kiriting").max(200) });

const DELETED_NAME = "O'chirilgan foydalanuvchi";

/**
 * Akkauntni o'chirish (anonimlashtirish): ism/email/telefon/avatar o'chiriladi, parol tasodifiy, sessiyalar bekor,
 * mutaxassis profili + portfolio + sevimlilar + bildirishnomalar + saqlangan qidiruvlar o'chiriladi.
 * Buyurtma/to'lov daftari (ledger) SAQLANADI: mutaxassis profiliga buyurtma/to'lov bog'langan bo'lsa (FK kaskad —
 * o'chirsak daftar yo'qoladi) profil o'chirilmaydi, balki bo'shatiladi va isBanned bilan ro'yxatdan yashiriladi.
 * Rad etiladi (409): eskroudagi (created/pending/paid) to'lovlar yoki kutilayotgan pul chiqarish so'rovi bo'lsa;
 * o'quvchisi yoki tugamagan hisob-kitobi bor ustoz (o'chsa — pul to'lagan o'quvchilar darsdan ayrilardi).
 * Admin hisobini bu yerdan o'chirib bo'lmaydi.
 * 7-audit: kirish bog'lanishlari (Google, Telegram) va taxallus ham uziladi — aks holda o'sha Google/Telegram bilan qayta
 * ro'yxatdan o'tib bo'lmasdi (bloklangan eski hisob topilardi); ijtimoiy tarmoq ma'lumotlari `purgeAccountData` bilan tozalanadi.
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  await enforceLimit("accountDelete", session.sub);
  const input = await parseBody(req, schema);

  const user = await db.query.users.findFirst({ where: eq(users.id, session.sub), with: { specialist: { columns: { id: true } } } });
  if (!user) throw new ApiError(401, "Foydalanuvchi topilmadi");
  if (user.role === "admin") throw new ApiError(403, "Admin hisobini bu yerdan o'chirib bo'lmaydi");
  if (!(await verifyPassword(input.password, user.passwordHash))) {
    throw new ApiError(422, "Parol noto'g'ri", { password: "Parol noto'g'ri" });
  }
  const spId = user.specialist?.id ?? null;

  // Eskrouda turgan pul yoki kutilayotgan pul chiqarish — avval yakunlansin
  const inFlight = await db.query.payments.findFirst({
    where: and(spId ? or(eq(payments.clientId, user.id), eq(payments.specialistId, spId)) : eq(payments.clientId, user.id), inArray(payments.state, ["created", "pending", "paid"])),
    columns: { id: true },
  });
  if (inFlight) throw new ApiError(409, "Eskroudagi to'lovlar yakunlanmaguncha akkauntni o'chirib bo'lmaydi");
  if (spId) {
    const openPayout = await db.query.payouts.findFirst({ where: and(eq(payouts.specialistId, spId), inArray(payouts.state, ["requested", "approved"])), columns: { id: true } });
    if (openPayout) throw new ApiError(409, "Kutilayotgan pul chiqarish so'rovi bor — u yakunlangach o'chirish mumkin");
  }

  if (await mentorBlocksDeletion(user.id)) {
    throw new ApiError(409, "Ustoz hisobingizda o'quvchilar yoki tugamagan hisob-kitob bor. Hisobni o'chirish uchun qo'llab-quvvatlashga yozing");
  }

  // 1) Hisobni anonimlashtirish (kirish darhol yopiladi: parol tasodifiy, sessiya versiyasi +1, bloklangan)
  await db
    .update(users)
    .set({
      name: DELETED_NAME,
      email: `deleted-${user.id}@redince.invalid`,
      phone: null,
      avatarUrl: null,
      gender: null,
      username: null,
      prevUsername: null,
      googleId: null,
      telegramChatId: null,
      emailVerified: false,
      notifyEmail: false,
      notifyPrefs: {},
      digestFreq: "off",
      showOnline: false,
      profilePrivate: true,
      dmPolicy: "none",
      commentPolicy: "none",
      commentFilter: null,
      lastSeenAt: null,
      lang: null,
      totpEnabled: false,
      totpSecretEnc: null,
      recoveryCodes: [],
      isBanned: true,
      bannedReason: "deleted",
      passwordHash: await hashPassword(randomBytes(32).toString("base64url")),
      sessionVersion: sql`${users.sessionVersion} + 1`,
    })
    .where(eq(users.id, user.id));

  // 2) Mutaxassis profili: daftar bog'lanmagan bo'lsa o'chiriladi (portfolio/sharh/sevimlilar kaskad), aks holda bo'shatiladi
  let profile: "deleted" | "anonymized" | null = null;
  if (spId) {
    const hasLedger = await db.query.orders.findFirst({ where: eq(orders.specialistId, spId), columns: { id: true } });
    if (!hasLedger) {
      await db.delete(specialists).where(eq(specialists.id, spId));
      profile = "deleted";
    } else {
      await db.delete(portfolioItems).where(eq(portfolioItems.specialistId, spId));
      await db
        .update(specialists)
        .set({
          slug: `deleted-${spId.slice(0, 12)}`,
          title: "O'chirilgan profil",
          bio: "",
          skills: [],
          equipment: [],
          languages: [],
          telegram: null,
          instagram: null,
          youtube: null,
          website: null,
          coverUrl: null,
          visibility: { telegram: "hidden", instagram: "hidden", youtube: "hidden", website: "hidden", phone: "hidden", email: "hidden", schedule: "hidden", gender: "hidden", city: "hidden" },
          schedule: null,
          vacationUntil: null,
          isAvailable: false,
          isVerified: false,
          isFeatured: false,
          topRated: false,
          updatedAt: new Date(),
        })
        .where(eq(specialists.id, spId));
      profile = "anonymized";
    }
  }

  // 3) Shaxsiy yozuvlar
  await Promise.all([
    db.delete(favorites).where(eq(favorites.userId, user.id)),
    db.delete(notifications).where(eq(notifications.userId, user.id)),
    db.delete(savedSearches).where(eq(savedSearches.userId, user.id)),
    db.delete(passwordResets).where(eq(passwordResets.userId, user.id)),
  ]);

  // 4) Ijtimoiy tarmoq ma'lumotlari (postlar, story, rezyume, arizalar, obunalar, push, a'zoliklar…)
  const purge = await purgeAccountData(user.id, user.telegramChatId ?? null);

  await revokeAllSessions(user.id).catch(() => undefined);
  await audit(user.id, "account_deleted", { targetType: "user", targetId: user.id, meta: { role: user.role, profile, ...(purge.failed.length ? { purgeFailed: purge.failed } : {}) } }, req);
  const current = await getSession();
  if (current) await revokeSession(current).catch(() => undefined);
  await clearSession();
  return ok({ deleted: true });
});
