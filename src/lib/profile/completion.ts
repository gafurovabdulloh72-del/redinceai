import { cache } from "react";
import { count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { portfolioItems, type Specialist } from "@/lib/db/schema";
import type { Tr } from "@/lib/i18n";
import { profilePostCounts } from "@/lib/profile/posts";
import { isTelegramEnabled, telegramBotUsername } from "@/lib/telegram";

/**
 * PROFIL TAYYORLIGI (2026-11-04): «profil 60% tayyor, 2 qadam qoldi» — BITTA manba.
 * ProfileMeter (o'ng rail / lenta / kabinet yon paneli), Kabinet → Profil tepasidagi ixcham karta
 * va kabinet umumiy sahifasidagi ro'yxat shu hisobdan foydalanadi.
 * Mutaxassis: 11 qadam (vaznli); mijoz: 5 ta oddiy qadam. So'rov davomida `cache()` bilan bir marta hisoblanadi.
 */
export type CompletionKey = "avatar" | "bio" | "category" | "region" | "price" | "portfolio" | "post" | "telegram" | "email" | "workHistory" | "twoFactor" | "name" | "phone";

export interface CompletionStep {
  key: CompletionKey;
  label: Tr;
  done: boolean;
  href: string;
  weight: number;
}

export interface ProfileCompletion {
  pct: number;
  steps: CompletionStep[];
  done: number;
  total: number;
  /** Bajarilmagan qadamlar soni */
  left: number;
  /** Eng og'ir bajarilmagan qadam (hammasi tayyor — null) */
  next: CompletionStep | null;
  role: "specialist" | "client";
}

/** Tavsif «to'liq» hisoblanadigan uzunlik */
export const BIO_MIN = 80;
const PORTFOLIO_MIN = 3;

interface Source {
  id: string;
  role: string;
  name: string;
  avatarUrl: string | null;
  phone?: string | null;
  emailVerified: boolean;
  totpEnabled?: boolean;
  telegramChatId?: string | null;
  specialist?: Specialist | null;
}

const L = (uz: string, ru: string): Tr => ({ uz, ru });

function finish(steps: CompletionStep[], role: "specialist" | "client"): ProfileCompletion {
  const total = steps.reduce((s, x) => s + x.weight, 0) || 1;
  const got = steps.filter((s) => s.done).reduce((s, x) => s + x.weight, 0);
  const pending = steps.filter((s) => !s.done).sort((a, b) => b.weight - a.weight);
  return {
    pct: Math.max(0, Math.min(100, Math.round((got / total) * 100))),
    steps,
    done: steps.length - pending.length,
    total: steps.length,
    left: pending.length,
    next: pending[0] ?? null,
    role,
  };
}

export const profileCompletion = cache(async (user: Source): Promise<ProfileCompletion> => {
  const telegramOn = isTelegramEnabled() && Boolean(telegramBotUsername());
  const sp = user.specialist ?? null;
  const isSpecialist = Boolean(sp) || user.role === "specialist";

  if (!isSpecialist) {
    // Mijoz: oddiy to'plam — ism, rasm, email, telefon, Telegram
    const steps: CompletionStep[] = [
      { key: "name", label: L("Ism-familiya", "Имя и фамилия"), done: user.name.trim().split(/\s+/).length >= 2, href: "/kabinet/profil?tab=akkaunt", weight: 20 },
      { key: "avatar", label: L("Profil rasmi", "Фото профиля"), done: Boolean(user.avatarUrl), href: "/kabinet/profil?tab=akkaunt#rasm", weight: 25 },
      { key: "email", label: L("Email tasdiqlangan", "Email подтверждён"), done: user.emailVerified, href: "/kabinet/xavfsizlik", weight: 25 },
      { key: "phone", label: L("Telefon raqami", "Номер телефона"), done: Boolean(user.phone?.trim()), href: "/kabinet/profil?tab=akkaunt", weight: 15 },
    ];
    if (telegramOn) steps.push({ key: "telegram", label: L("Telegram ulangan", "Telegram подключён"), done: Boolean(user.telegramChatId), href: "/kabinet/profil?tab=telegram", weight: 15 });
    return finish(steps, "client");
  }

  // Mutaxassis: 2 ta yengil sanash so'rovi parallel
  const [portfolio, posts] = await Promise.all([
    sp ? db.select({ n: count() }).from(portfolioItems).where(eq(portfolioItems.specialistId, sp.id)).then((r) => r[0]?.n ?? 0).catch(() => 0) : Promise.resolve(0),
    profilePostCounts(user.id, { id: user.id, role: user.role })
      .then((c) => c.posts)
      .catch(() => 0),
  ]);
  const steps: CompletionStep[] = [
    { key: "avatar", label: L("Profil rasmi", "Фото профиля"), done: Boolean(user.avatarUrl), href: "/kabinet/profil?tab=akkaunt#rasm", weight: 12 },
    { key: "bio", label: L(`O'zingiz haqingizda (${BIO_MIN}+ belgi)`, `О себе (${BIO_MIN}+ символов)`), done: (sp?.bio?.trim().length ?? 0) >= BIO_MIN, href: "/kabinet/profil?tab=mutaxassis#bio", weight: 12 },
    { key: "category", label: L("Kasb tanlangan", "Профессия выбрана"), done: Boolean(sp?.category), href: "/kabinet/profil?tab=mutaxassis", weight: 8 },
    { key: "region", label: L("Hudud ko'rsatilgan", "Регион указан"), done: Boolean(sp?.regionSlug), href: "/kabinet/profil?tab=mutaxassis", weight: 6 },
    { key: "price", label: L("Boshlang'ich narx", "Стартовая цена"), done: (sp?.priceFrom ?? 0) > 0, href: "/kabinet/profil?tab=mutaxassis#narx", weight: 8 },
    { key: "portfolio", label: L(`Kamida ${PORTFOLIO_MIN} ta ish`, `Минимум ${PORTFOLIO_MIN} работы`), done: portfolio >= PORTFOLIO_MIN, href: "/kabinet/portfolio", weight: 14 },
    { key: "post", label: L("Birinchi post", "Первый пост"), done: posts >= 1, href: "/kabinet/postlar", weight: 10 },
    { key: "email", label: L("Email tasdiqlangan", "Email подтверждён"), done: user.emailVerified, href: "/kabinet/xavfsizlik", weight: 8 },
    { key: "workHistory", label: L("Ish tajribasi", "Опыт работы"), done: (sp?.workHistory?.length ?? 0) > 0, href: "/kabinet/profil?tab=mutaxassis#tajriba", weight: 8 },
    { key: "twoFactor", label: L("Ikki bosqichli himoya (2FA)", "Двухфакторная защита (2FA)"), done: Boolean(user.totpEnabled), href: "/kabinet/xavfsizlik", weight: 4 },
  ];
  if (telegramOn) steps.push({ key: "telegram", label: L("Telegram ulangan", "Telegram подключён"), done: Boolean(user.telegramChatId), href: "/kabinet/profil?tab=telegram", weight: 10 });
  return finish(steps, "specialist");
});

/** 100% bo'lsa null — karta chizilmaydi */
export async function ownCompletion(user: Source): Promise<ProfileCompletion | null> {
  const c = await profileCompletion(user);
  return c.pct >= 100 ? null : c;
}
