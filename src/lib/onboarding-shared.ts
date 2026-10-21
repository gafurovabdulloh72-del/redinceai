/** Yangi ijodkor yo'riqnomasining klientga xavfsiz qismi (server kodi: lib/onboarding.ts) */
export type OnboardingKey = "profile" | "avatar" | "bio" | "portfolio" | "post" | "community" | "telegram";

export interface OnboardingStep {
  key: OnboardingKey;
  done: boolean;
  href: string;
}

/** «Keyinroq» bosilganda yoziladigan cookie (30 kun) — bosh sahifa kartasi shu muddat chiqmaydi */
export const ONBOARDING_COOKIE = "ob_off";

/** Ro'yxatdan o'tganiga shuncha kun bo'lgan ijodkorgacha yo'riqnoma (bosh sahifa kartasi va jamlamadagi eslatma) ko'rsatiladi */
export const ONBOARDING_DAYS = 45;
