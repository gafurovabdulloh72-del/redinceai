import Link from "next/link";
import { Check, Lock, PlayCircle } from "lucide-react";
import { formatDuration } from "@/lib/mentorship/format";
import { cn } from "@/lib/utils";

export interface SidebarLesson {
  id: string;
  title: string;
  position: number;
  durationMin: number;
  /** Kurs bo'limi (Udemy section) — bo'sh bo'lishi mumkin */
  section?: string;
  completed: boolean;
  locked: boolean;
}

/**
 * Dars sahifasidagi kurs ro'yxati (lg+ da o'ngda yopishqoq, telefonda pleyer ostida).
 * Oldin dars sahifasida umuman ro'yxat yo'q edi — faqat «keyingi dars» havolasi bor edi.
 */
export function LessonSidebar({ courseTitle, courseSlug, lessons, currentId, progressPct }: { courseTitle: string; courseSlug: string; lessons: SidebarLesson[]; currentId: string; progressPct: number }) {
  const done = lessons.filter((l) => l.completed).length;
  const hasSections = new Set(lessons.map((l) => l.section ?? "")).size > 1;
  return (
    <aside className="card overflow-hidden" aria-label="Kurs darslari">
      <div className="border-b border-line p-3.5">
        <Link href={`/mentorlik/${courseSlug}`} className="line-clamp-2 text-[14px] font-bold leading-snug text-fg transition hover:text-accent-text">
          {courseTitle}
        </Link>
        <p className="mt-1.5 text-[12px] text-fg-3">
          {done} / {lessons.length} dars
        </p>
        <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-fg/8" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100} aria-label="Kurs progressi">
          <span className="block h-full rounded-full bg-fg transition-[width] duration-500" style={{ width: `${progressPct}%` }} />
        </span>
      </div>
      <ol className="max-h-[60vh] overflow-y-auto">
        {lessons.map((l, i) => {
          const on = l.id === currentId;
          // Bo'lim sarlavhasi — yangi bo'lim boshlanganda (bir nechta bo'lim bo'lsa)
          const sectionHead = hasSections && (i === 0 || (lessons[i - 1].section ?? "") !== (l.section ?? "")) ? l.section || "Bo'limsiz" : null;
          const Row = (
            <>
              <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold", l.completed ? "bg-fg text-ink-fg" : on ? "bg-fg/10 text-fg" : "bg-fg/6 text-fg-3")}>
                {l.completed ? <Check size={12} /> : l.locked ? <Lock size={11} /> : l.position}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-[13.5px]", on ? "font-bold text-fg" : "text-fg-2")}>{l.title}</span>
                {l.durationMin > 0 && <span className="block text-[11.5px] text-fg-4">{formatDuration(l.durationMin)}</span>}
              </span>
              {on && <PlayCircle size={15} className="shrink-0 text-fg" />}
            </>
          );
          return (
            <li key={l.id} className={cn("border-b border-line last:border-0", on && "bg-fg/[0.03]")}>
              {sectionHead && <p className="border-b border-line bg-fg/[0.03] px-3.5 py-1.5 text-[11.5px] font-bold uppercase tracking-wide text-fg-3">{sectionHead}</p>}
              {l.locked ? (
                <span className="flex cursor-not-allowed items-center gap-2.5 px-3.5 py-2.5 opacity-55" title="Kursga yozilgach ochiladi">
                  {Row}
                </span>
              ) : (
                <Link href={`/mentorlik/dars/${l.id}`} aria-current={on ? "page" : undefined} className="flex items-center gap-2.5 px-3.5 py-2.5 transition hover:bg-fg/5">
                  {Row}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
