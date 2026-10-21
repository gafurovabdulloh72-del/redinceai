"use client";

import { useLocale } from "@/components/i18n/LocaleProvider";
import { tr, type Locale } from "@/lib/i18n";
import { AUTH } from "@/lib/i18n/dict/auth";
import { passwordStrength } from "@/lib/security/password-strength";
import { cn } from "@/lib/utils";

const TONE: Record<number, string> = {
  1: "bg-ios-red",
  2: "bg-ios-orange",
  3: "bg-accent",
  4: "bg-ios-green",
};

/**
 * Yorliq va maslahatni joriy tilda qaytaradi. passwordStrength() matnlari o'zbekcha
 * (lib o'zgarmaydi) — bu yerda score + parol tarkibidan tilga mos matn tiklanadi.
 */
function localizedMeta(til: Locale, pw: string, score: number): { label: string; hint: string } {
  if (!pw) return { label: "", hint: tr(til, AUTH.password.hintEmpty) };
  if (score <= 1) {
    if (pw.length < 8) return { label: tr(til, AUTH.password.labelTooShort), hint: AUTH.password.hintMoreChars[til](8 - pw.length) };
    if (!/\d/.test(pw)) return { label: tr(til, AUTH.password.labelWeak), hint: tr(til, AUTH.password.hintAddDigit) };
    return { label: tr(til, AUTH.password.labelWeak), hint: tr(til, AUTH.password.hintAddLetter) };
  }
  if (score === 2) return { label: tr(til, AUTH.password.labelMedium), hint: tr(til, AUTH.password.hintMedium) };
  if (score === 3) return { label: tr(til, AUTH.password.labelGood), hint: tr(til, AUTH.password.hintGood) };
  return { label: tr(til, AUTH.password.labelStrong), hint: tr(til, AUTH.password.hintStrong) };
}

/** 4 segmentli parol kuchi ko'rsatkichi + maslahat (A24) */
export function PasswordStrengthMeter({ password, id }: { password: string; id?: string }) {
  const til = useLocale();
  const s = passwordStrength(password);
  const { label, hint } = localizedMeta(til, password, s.score);
  const tone = TONE[s.score] ?? "bg-line-2";
  return (
    <div id={id} className="mt-2" aria-live="polite">
      <div
        className="flex gap-1.5"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={s.score}
        aria-label={label ? AUTH.password.strengthAriaWith[til](label) : tr(til, AUTH.password.strengthAria)}
      >
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", i <= s.score ? tone : "bg-line-2")} />
        ))}
      </div>
      <p className="mt-1.5 flex items-center justify-between gap-3 text-[12px] leading-snug short:hidden">
        <span className="text-fg-3">{hint}</span>
        {label && <span className={cn("shrink-0 font-semibold", s.score <= 1 ? "text-ios-red" : s.score === 2 ? "text-[#c2410c] dark:text-ios-orange" : s.score === 3 ? "text-accent" : "text-[#15803d] dark:text-ios-green")}>{label}</span>}
      </p>
    </div>
  );
}
