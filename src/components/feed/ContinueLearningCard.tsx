import Link from "next/link";
import { ChevronRight, GraduationCap, Play } from "lucide-react";
import { SafeImage } from "@/components/specialists/SafeImage";
import type { ContinueLearning } from "@/lib/mentorship/service";
import type { Locale } from "@/lib/i18n";

/**
 * Bosh sahifa: «O'qishni davom ettirish» (Udemy/Coursera «Continue learning») — tugallanmagan kursning navbatdagi darsi,
 * progress chizig'i bilan. Bitta qator, telefonda yassi (`m-flat`). Faqat kursga yozilgan va tugatmaganlarga.
 */
export function ContinueLearningCard({ c, til }: { c: ContinueLearning; til: Locale }) {
  const ru = til === "ru";
  return (
    <Link href={`/mentorlik/dars/${c.lessonId}`} className="card group flex items-center gap-3.5 p-3.5 transition hover:border-fg m-flat" aria-label={`${ru ? "Продолжить" : "Davom etish"}: ${c.courseTitle} — ${c.lessonTitle}`}>
      <span className="relative h-14 w-20 shrink-0 overflow-hidden rounded-[10px] bg-fg/5">
        {c.coverUrl ? <SafeImage src={c.coverUrl} alt="" width={160} height={112} className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center text-fg-4"><GraduationCap size={20} /></span>}
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white/90 text-black shadow-sm transition group-hover:scale-105">
            <Play size={14} className="ml-0.5 fill-current" />
          </span>
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11.5px] font-semibold uppercase tracking-wide text-fg-4">{ru ? "Продолжить обучение" : "O'qishni davom ettirish"}</span>
        <span className="mt-0.5 block truncate text-[14.5px] font-bold leading-snug text-fg">{c.courseTitle}</span>
        <span className="mt-0.5 block truncate text-[12.5px] text-fg-3">
          {c.lessonPosition}-{ru ? "урок" : "dars"} · {c.lessonTitle}
        </span>
        <span className="mt-2 flex items-center gap-2">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-fg/10">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(3, c.progressPct)}%` }} />
          </span>
          <span className="shrink-0 text-[11.5px] font-semibold tabular-nums text-fg-3">{c.progressPct}%</span>
        </span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-fg-4 transition group-hover:text-fg" />
    </Link>
  );
}
