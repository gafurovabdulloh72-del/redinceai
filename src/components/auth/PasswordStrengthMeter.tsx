"use client";

import { passwordStrength } from "@/lib/security/password-strength";
import { cn } from "@/lib/utils";

const TONE: Record<number, string> = {
  1: "bg-ios-red",
  2: "bg-ios-orange",
  3: "bg-accent",
  4: "bg-ios-green",
};

/** 4 segmentli parol kuchi ko'rsatkichi + maslahat (A24) */
export function PasswordStrengthMeter({ password, id }: { password: string; id?: string }) {
  const s = passwordStrength(password);
  const tone = TONE[s.score] ?? "bg-line-2";
  return (
    <div id={id} className="mt-2" aria-live="polite">
      <div className="flex gap-1.5" role="meter" aria-valuemin={0} aria-valuemax={4} aria-valuenow={s.score} aria-label={s.label ? `Parol kuchi: ${s.label}` : "Parol kuchi"}>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", i <= s.score ? tone : "bg-line-2")} />
        ))}
      </div>
      <p className="mt-1.5 flex items-center justify-between gap-3 text-[12px] leading-snug">
        <span className="text-fg-3">{s.hint}</span>
        {s.label && <span className={cn("shrink-0 font-semibold", s.score <= 1 ? "text-ios-red" : s.score === 2 ? "text-[#c2410c] dark:text-ios-orange" : s.score === 3 ? "text-accent" : "text-[#15803d] dark:text-ios-green")}>{s.label}</span>}
      </p>
    </div>
  );
}
