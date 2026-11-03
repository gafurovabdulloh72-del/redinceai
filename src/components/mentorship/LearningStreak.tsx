import { Flame } from "lucide-react";
import type { LearningStreak as StreakData } from "@/lib/mentorship/streak";
import { cn } from "@/lib/utils";
import { tr, type Locale } from "@/lib/i18n";
import { MS, WEEK_DAYS } from "@/lib/i18n/dict/mentorship";

/**
 * O'quv seriyasi kartasi (kabinet → Mentorlik): olov + N kun, haftaning 7 nuqtasi, qisqa undov.
 * Server komponent — ma'lumot `learningStreak()` dan.
 */
export function LearningStreakCard({ s, til = "uz" }: { s: StreakData; til?: Locale }) {
  const DAYS = WEEK_DAYS[til];
  // Toshkent bo'yicha bugungi hafta kuni: Ya=0 → 6, Du=1 → 0
  const todayIdx = (new Date(Date.now() + 5 * 3600 * 1000).getUTCDay() + 6) % 7;
  const hint = s.todayDone
    ? s.current >= 7
      ? tr(til, MS.streakGreat)
      : tr(til, MS.streakDone)
    : s.current > 0
      ? tr(til, MS.streakKeep)
      : tr(til, MS.streakStart);
  return (
    <section className="card flex items-center gap-4 p-4 m-flat" aria-label={tr(til, MS.streakAria)}>
      <div className={cn("grid h-14 w-14 shrink-0 place-items-center rounded-full", s.current > 0 ? "bg-accent-soft text-accent-text" : "bg-fg/6 text-fg-4")}>
        <Flame size={26} className={s.current > 0 ? "fill-current" : ""} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold leading-tight text-fg">
          {s.current > 0 ? MS.streakDays[til](s.current) : tr(til, MS.streakNone)}
          {s.best > s.current && <span className="ml-2 text-[12px] font-semibold text-fg-4">{tr(til, MS.record)} {s.best}</span>}
        </p>
        <p className="mt-0.5 text-[12.5px] leading-snug text-fg-3">{hint}</p>
        <ol className="mt-2.5 flex gap-2" aria-label={tr(til, MS.weekDays)}>
          {s.week.map((on, i) => (
            <li key={DAYS[i]} className="flex flex-col items-center gap-1 text-[10px] font-semibold text-fg-4">
              <span className={cn("grid h-6 w-6 place-items-center rounded-full border text-[10px]", on ? "border-accent bg-accent text-white" : i === todayIdx ? "border-fg/40 text-fg-3" : "border-line")} aria-label={`${DAYS[i]}${on ? tr(til, MS.dayDone) : ""}`}>
                {on ? "✓" : ""}
              </span>
              {DAYS[i]}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
