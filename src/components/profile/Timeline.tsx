import { Briefcase, GraduationCap } from "lucide-react";
import { tr, type Locale } from "@/lib/i18n";
import { PROFIL_X, TAJRIBA } from "@/lib/i18n/dict/profile";
import { cn } from "@/lib/utils";

export interface WorkEntry {
  role: string;
  company: string;
  fromYear: number;
  toYear?: number | null;
  description?: string | null;
}
export interface EduEntry {
  school: string;
  degree: string;
  fromYear: number;
  toYear?: number | null;
}

type Item = { kind: "work" | "edu"; title: string; sub: string; from: number; to: number | null; desc?: string | null };

/** Ish tajribasi yillari — oraliqlar birlashtirilgan holda (parallel ishlar ikki marta sanalmaydi) */
export function totalExperienceYears(work: readonly WorkEntry[], now = new Date().getFullYear()): number {
  const years = new Set<number>();
  for (const w of work) {
    const to = Math.min(w.toYear ?? now, now);
    for (let y = w.fromYear; y < Math.max(w.fromYear + 1, to); y++) years.add(y);
  }
  return years.size;
}

/**
 * «Yo'l» — ish tajribasi va ta'lim bitta xronologik chiziqda (yangisi yuqorida), umumiy tajriba yillari bilan.
 * Alohida ikkita bo'lim o'rniga bitta — kamroq sarlavha, aniqroq xronologiya.
 */
export function Timeline({ work, education, til, className }: { work: readonly WorkEntry[]; education: readonly EduEntry[]; til: Locale; className?: string }) {
  const now = new Date().getFullYear();
  const items: Item[] = [
    ...work.map<Item>((w) => ({ kind: "work", title: w.role, sub: w.company, from: w.fromYear, to: w.toYear ?? null, desc: w.description })),
    ...education.map<Item>((e) => ({ kind: "edu", title: e.degree, sub: e.school, from: e.fromYear, to: e.toYear ?? null })),
  ].sort((a, b) => (b.to ?? now + 1) - (a.to ?? now + 1) || b.from - a.from);
  if (items.length === 0) return null;
  const total = work.length ? totalExperienceYears(work, now) : 0;

  return (
    <section className={cn("card p-5 sm:p-7", className)} aria-labelledby="yol-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="yol-title" className="font-display text-[20px] font-semibold tracking-tight text-fg">
          {tr(til, PROFIL_X.timelineTitle)}
        </h2>
        {work.length > 0 && <p className="text-[13px] text-fg-3">{PROFIL_X.timelineTotal[til](total)}</p>}
      </div>
      <ol className="relative mt-5 space-y-5 border-l border-line pl-6">
        {items.map((it, i) => {
          const Icon = it.kind === "work" ? Briefcase : GraduationCap;
          const ongoing = it.to == null;
          return (
            <li key={`${it.kind}-${it.title}-${i}`} className="relative">
              <span
                className={cn("absolute -left-[31px] top-0 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-surface", ongoing ? "text-fg" : "text-fg-3")}
                aria-label={it.kind === "work" ? tr(til, PROFIL_X.timelineWork) : tr(til, PROFIL_X.timelineEdu)}
              >
                <Icon size={12} aria-hidden />
              </span>
              <p className="text-[12.5px] tabular-nums text-fg-3">
                {it.from} — {it.to ?? tr(til, it.kind === "work" ? TAJRIBA.present : TAJRIBA.studying)}
              </p>
              <p className="mt-0.5 text-[15px] font-semibold leading-snug text-fg">{it.title}</p>
              <p className="text-[13.5px] text-fg-2">{it.sub}</p>
              {it.desc && <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg-2">{it.desc}</p>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
