import { getCurrentUser } from "@/lib/auth";
import { handler, ok } from "@/lib/api";

/**
 * Joriy foydalanuvchi — FAQAT mijozga kerakli maydonlar (7-audit). Ilgari bazadagi qator deyarli to'liq qaytardi:
 * admin izohi (`adminNote`), blok sababi, Google identifikatori, sessiya versiyasi, Telegram chat id kabi ichki maydonlar
 * har bir kirgan foydalanuvchiga (o'zi haqidagi admin yozuvi bilan birga) ko'rinardi. Sessiya eskirgan bo'lsa — null.
 */
export const GET = handler(async () => {
  const u = await getCurrentUser();
  if (!u) return ok(null, { headers: { "Cache-Control": "no-store" } });
  const sp = u.specialist;
  return ok(
    {
      id: u.id,
      name: u.name,
      username: u.username,
      email: u.email,
      emailVerified: u.emailVerified,
      role: u.role,
      avatarUrl: u.avatarUrl,
      phone: u.phone,
      gender: u.gender,
      lang: u.lang,
      createdAt: u.createdAt.getTime(),
      twoFactor: u.totpEnabled,
      googleLinked: Boolean(u.googleId),
      telegramLinked: Boolean(u.telegramChatId),
      profilePrivate: u.profilePrivate,
      specialist: sp ? { id: sp.id, slug: sp.slug, title: sp.title, category: sp.category, regionSlug: sp.regionSlug, isVerified: sp.isVerified } : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
});
