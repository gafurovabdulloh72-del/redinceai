/**
 * Ijtimoiy limitlar (klientga xavfsiz). Har tarifda chegarasi bor (2026-11-03): profil posti 7 kunda
 * Standart 2 · Pro 7 · Max 20, story 7 kunda 4 · 14 · 40 (lib/subscriptions/pro.ts `TIER_LIMITS`).
 * Hisob: sirpanuvchi oyna (rolling window). Quyidagi POST_/STORY_WEEKLY_LIMIT — Standart qiymatlari.
 */
export const POST_WEEKLY_LIMIT = 2;
export const POST_WEEKLY_LIMIT_PRO = 7;
export const POST_WEEKLY_LIMIT_MAX = 20;
export const STORY_WEEKLY_LIMIT_PRO = 14;
export const STORY_WEEKLY_LIMIT_MAX = 40;
export const POST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const STORY_WEEKLY_LIMIT = 4;
export const STORY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** Story yashash muddati */
export const STORY_TTL_MS = 24 * 60 * 60 * 1000;
export const STORY_CAPTION_MAX = 220;
/** Matnli story fonlari (kalit → CSS gradient) */
export const STORY_BACKGROUNDS: Record<string, string> = {
  coral: "linear-gradient(150deg,#ff7a45,#e0412b)",
  night: "linear-gradient(150deg,#1d1d22,#3a2f5a)",
  ocean: "linear-gradient(150deg,#2f6fd6,#1aa3a3)",
  sunset: "linear-gradient(150deg,#f7b733,#fc4a1a)",
  forest: "linear-gradient(150deg,#1f8a5b,#0f4c3a)",
  lilac: "linear-gradient(150deg,#a78bfa,#ec4899)",
};
export const MUSIC_TITLE_MAX = 80;

/** Kvota holati (UI): limit null — cheksiz (hozir ishlatilmaydi — har tarifda chegara bor) */
export interface QuotaInfo {
  premium: boolean;
  tier?: "free" | "pro" | "max";
  posts: { used: number; limit: number | null; resetAt: number | null };
  stories: { used: number; limit: number | null; resetAt: number | null };
}
