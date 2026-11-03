/**
 * TARIFLAR (2026-11-03) — klientga xavfsiz yagona manba: Standart (0) · Pro · Max.
 *
 * Pro  = to'langan va muddati o'tmagan obuna (`subscriptionUntil > now`), oylik TOP sovg'asi
 *        (`awardPremiumUntil > now`) yoki imtiyozli shaxs (`isPrivileged`).
 * Max  = to'langan obuna + `subscriptionTier = "max"` (yoki imtiyozli shaxs — admin/test uchun hammasi ochiq).
 * Bepul sinov davri Pro EMAS — sinovda profil ko'rinadi, limitlar Standart'niki.
 * Server tomoni: `isPremium()`/`premiumTier()` (social/quota.ts), katalog saralashi `proRankSql()` (queries.ts),
 * e'lon xabari `alertProSpecialistsAboutJob` (jobs/server.ts) — shu qoidani takrorlaydi.
 */
import { MAX_PROPOSAL_DAILY_LIMIT, PRO_PROPOSAL_DAILY_LIMIT, PROPOSAL_DAILY_LIMIT } from "@/lib/constants";
import { POST_WEEKLY_LIMIT, POST_WEEKLY_LIMIT_MAX, POST_WEEKLY_LIMIT_PRO, STORY_WEEKLY_LIMIT, STORY_WEEKLY_LIMIT_MAX, STORY_WEEKLY_LIMIT_PRO } from "@/lib/social/limits";
import type { Locale } from "@/lib/i18n";

export type Tier = "free" | "pro" | "max";

export interface ProSubject {
  subscriptionUntil?: Date | number | null;
  awardPremiumUntil?: Date | number | null;
  isPrivileged?: boolean | null;
  subscriptionTier?: string | null;
}

const ms = (v: Date | number | null | undefined) => (v == null ? 0 : v instanceof Date ? v.getTime() : Number(v));

export function tierOf(sp: ProSubject, now = Date.now()): Tier {
  if (sp.isPrivileged) return "max";
  const paid = ms(sp.subscriptionUntil) > now;
  if (paid && sp.subscriptionTier === "max") return "max";
  if (paid || ms(sp.awardPremiumUntil) > now) return "pro";
  return "free";
}

export function isProSpecialist(sp: ProSubject, now = Date.now()): boolean {
  return tierOf(sp, now) !== "free";
}

/**
 * TARIF CHEGARALARI — yagona jadval (har tarifda chegara bor, Pro'da ham):
 *   proposals — kunlik taklif · posts/stories — 7 kunlik sirpanuvchi oyna · portfolio — ishlar soni · viewers — «kim ko'rdi» ro'yxati
 */
export const TIER_LIMITS: Record<Tier, { proposals: number; posts: number; stories: number; portfolio: number; viewers: number }> = {
  free: { proposals: PROPOSAL_DAILY_LIMIT, posts: POST_WEEKLY_LIMIT, stories: STORY_WEEKLY_LIMIT, portfolio: 12, viewers: 0 },
  pro: { proposals: PRO_PROPOSAL_DAILY_LIMIT, posts: POST_WEEKLY_LIMIT_PRO, stories: STORY_WEEKLY_LIMIT_PRO, portfolio: 30, viewers: 8 },
  max: { proposals: MAX_PROPOSAL_DAILY_LIMIT, posts: POST_WEEKLY_LIMIT_MAX, stories: STORY_WEEKLY_LIMIT_MAX, portfolio: 60, viewers: 30 },
};

/** Kunlik taklif limiti: Standart 5 · Pro 20 · Max 50 */
export function proposalLimitFor(t: Tier | boolean): number {
  const tier: Tier = t === true ? "pro" : t === false ? "free" : t;
  return TIER_LIMITS[tier].proposals;
}

/** «Kim ko'rdi» ro'yxati uzunligi */
export const VIEWERS_LIST: Record<Tier, number> = { free: TIER_LIMITS.free.viewers, pro: TIER_LIMITS.pro.viewers, max: TIER_LIMITS.max.viewers };

export const tierLabel = (t: Tier, til: Locale = "uz") => (t === "max" ? "Max" : t === "pro" ? "Pro" : til === "ru" ? "Стандарт" : "Standart");

/** Pro imkoniyatlari (qisqa) — Kabinet → Obuna «Pro nimalar beradi» */
export function proPerks(til: Locale): Array<{ t: string; d: string }> {
  const L = TIER_LIMITS;
  return til === "ru"
    ? [
        { t: "Выше в каталоге и значок", d: "Pro — выше обычных профилей (PRO), Max — на самом верху (MAX)." },
        { t: "Новые заказы — сразу в Telegram", d: "Подходящий заказ приходит мгновенно; в Max — первым." },
        { t: "Больше предложений в день", d: `Стандарт ${L.free.proposals} · Pro ${L.pro.proposals} · Max ${L.max.proposals}.` },
        { t: "Больше постов и сторис", d: `В неделю: посты ${L.free.posts} / ${L.pro.posts} / ${L.max.posts}, сторис ${L.free.stories} / ${L.pro.stories} / ${L.max.stories}.` },
        { t: "Больше работ в портфолио", d: `Стандарт ${L.free.portfolio} · Pro ${L.pro.portfolio} · Max ${L.max.portfolio}.` },
        { t: "Статистика профиля", d: `Кто смотрел профиль (Pro — ${L.pro.viewers}, Max — ${L.max.viewers} чел.), топ постов, проданные контакты.` },
      ]
    : [
        { t: "Katalogda yuqorida va belgi", d: "Pro — oddiy profillardan oldin (PRO), Max — eng tepada (MAX)." },
        { t: "Yangi e'lon — darhol Telegramga", d: "Mos buyurtma joylanishi bilan xabar keladi; Max'da — birinchi bo'lib." },
        { t: "Ko'proq kunlik taklif", d: `Standart ${L.free.proposals} · Pro ${L.pro.proposals} · Max ${L.max.proposals} ta.` },
        { t: "Ko'proq post va story", d: `Haftasiga: post ${L.free.posts} / ${L.pro.posts} / ${L.max.posts}, story ${L.free.stories} / ${L.pro.stories} / ${L.max.stories} ta.` },
        { t: "Portfolioda ko'proq ish", d: `Standart ${L.free.portfolio} · Pro ${L.pro.portfolio} · Max ${L.max.portfolio} ta.` },
        { t: "Profil statistikasi", d: `Profilni kim ko'rdi (Pro — ${L.pro.viewers}, Max — ${L.max.viewers} kishi), top postlar, sotilgan kontaktlar.` },
      ];
}

/* ------------------------------------------------------------------ */
/* Tariflarni taqqoslash jadvali (/narxlar va Kabinet → Obuna)          */
/* ------------------------------------------------------------------ */
/** true — bor, false — yo'q, matn — aniq qiymat/cheklov */
export type PlanCell = boolean | string;
export interface PlanCompareRow {
  label: string;
  hint?: string;
  free: PlanCell;
  pro: PlanCell;
  max: PlanCell;
}
export interface PlanCompareGroup {
  title: string;
  rows: PlanCompareRow[];
}

export function planComparison(til: Locale, trialDays: number): PlanCompareGroup[] {
  const ru = til === "ru";
  const trial = trialDays > 0 ? (ru ? `Пробный период (${trialDays} дн.)` : `Sinov davrida (${trialDays} kun)`) : false;
  const day = (n: number) => (ru ? `${n} в день` : `Kuniga ${n} ta`);
  const week = (n: number) => (ru ? `${n} в неделю` : `Haftasiga ${n} ta`);
  const pcs = (n: number) => (ru ? `до ${n}` : `${n} tagacha`);
  return [
    {
      title: ru ? "Видимость" : "Ko'rinish",
      rows: [
        { label: ru ? "Каталог, карта и поиск" : "Katalog, xarita va qidiruv", free: trial, pro: true, max: true },
        { label: ru ? "Место в каталоге" : "Katalogdagi o'rin", free: ru ? "Обычное" : "Oddiy", pro: ru ? "Выше" : "Yuqorida", max: ru ? "На самом верху" : "Eng tepada" },
        { label: ru ? "Значок в профиле и карточке" : "Profil va kartadagi belgi", free: false, pro: "PRO", max: "MAX" },
        { label: ru ? "В рекомендуемых авторах" : "«Tavsiya etilgan ijodkorlar»da", hint: ru ? "Боковая панель ленты" : "Lenta yon panelida", free: false, pro: false, max: true },
      ],
    },
    {
      title: ru ? "Заказы" : "Buyurtmalar",
      rows: [
        { label: ru ? "Приём новых заказов" : "Yangi buyurtma qabul qilish", free: trial, pro: true, max: true },
        { label: ru ? "Предложения к заказам" : "E'lonlarga taklif", free: day(TIER_LIMITS.free.proposals), pro: day(TIER_LIMITS.pro.proposals), max: day(TIER_LIMITS.max.proposals) },
        { label: ru ? "Уведомление о новом заказе" : "Yangi e'lon xabari", hint: ru ? "По профессии и региону" : "Kasb va hudud bo'yicha", free: ru ? "Только в «Заказах»" : "Faqat «Ishlar»da", pro: ru ? "Сразу, Telegram" : "Darhol, Telegram", max: ru ? "Первым, Telegram" : "Birinchi bo'lib, Telegram" },
      ],
    },
    {
      title: ru ? "Контент" : "Kontent",
      rows: [
        { label: ru ? "Посты в профиле (Reels)" : "Profil postlari (Reels)", free: week(TIER_LIMITS.free.posts), pro: week(TIER_LIMITS.pro.posts), max: week(TIER_LIMITS.max.posts) },
        { label: ru ? "Сторис" : "Story", free: week(TIER_LIMITS.free.stories), pro: week(TIER_LIMITS.pro.stories), max: week(TIER_LIMITS.max.stories) },
        { label: ru ? "Работ в портфолио" : "Portfolio ishlari", free: pcs(TIER_LIMITS.free.portfolio), pro: pcs(TIER_LIMITS.pro.portfolio), max: pcs(TIER_LIMITS.max.portfolio) },
        { label: ru ? "Отзывы, чат, сообщества" : "Sharhlar, chat, jamoalar", free: true, pro: true, max: true },
      ],
    },
    {
      title: ru ? "Аналитика" : "Tahlil",
      rows: [
        { label: ru ? "Просмотры профиля по дням" : "Profil ko'rishlari (kunlik)", free: true, pro: true, max: true },
        { label: ru ? "Кто смотрел профиль" : "Profilni kim ko'rdi", free: false, pro: ru ? `Последние ${VIEWERS_LIST.pro}` : `Oxirgi ${VIEWERS_LIST.pro} kishi`, max: ru ? `Последние ${VIEWERS_LIST.max}` : `Oxirgi ${VIEWERS_LIST.max} kishi` },
        { label: ru ? "Топ постов и проданные контакты" : "Top postlar va sotilgan kontaktlar", free: false, pro: true, max: true },
      ],
    },
    {
      title: ru ? "Платежи" : "To'lovlar",
      rows: [
        { label: ru ? "Эскроу-платежи и вывод средств" : "Eskrou to'lovlar va pul yechish", free: true, pro: true, max: true },
        { label: ru ? "Продажа контакта через платформу" : "Kontaktingiz platforma orqali sotiladi", free: true, pro: true, max: true },
      ],
    },
  ];
}
