import Link from "next/link";
import { Camera, Clapperboard, Clock, GraduationCap, Megaphone, PenTool, Sparkles, Star, Users, Video, type LucideIcon } from "lucide-react";
import { SafeImage } from "@/components/specialists/SafeImage";
import { Avatar } from "@/components/ui";
import { categoryLabel, formatDuration, formatSom, levelLabel } from "@/lib/mentorship/format";
import { cn } from "@/lib/utils";

export interface CourseCardItem {
  id: string;
  slug: string;
  title: string;
  summary: string;
  coverUrl: string | null;
  category: string;
  level: string;
  priceFrom: number;
  lessonsCount: number;
  studentsCount: number;
  rating: number;
  mentor: { name: string; avatarUrl: string | null };
  /** Yaratilgan vaqt (ms) — «Yangi» belgisi uchun (ixtiyoriy) */
  createdAt?: number;
  /** Jami davomiylik (daqiqa), ixtiyoriy */
  totalMin?: number;
}

const NEW_DAYS = 14;
const POPULAR_STUDENTS = 10;
/** Udemy uslubidagi belgi: «Mashhur» (≥10 talaba) yoki «Yangi» (≤14 kun) — bittasi, mashhurlik ustun */
export function courseBadge(c: Pick<CourseCardItem, "studentsCount" | "createdAt">): { label: string; tone: "pop" | "new" } | null {
  if (c.studentsCount >= POPULAR_STUDENTS) return { label: "Mashhur", tone: "pop" };
  if (c.createdAt && Date.now() - c.createdAt < NEW_DAYS * 86_400_000) return { label: "Yangi", tone: "new" };
  return null;
}
const BADGE_CLS = { pop: "bg-accent text-white", new: "bg-ink text-ink-fg" } as const;

/** Yo'nalish ikonkasi — muqova yo'q bo'lsa karta boshiga qo'yiladi */
export const CATEGORY_ICON: Record<string, LucideIcon> = {
  montaj: Clapperboard,
  videografiya: Video,
  dizayn: PenTool,
  motion: Sparkles,
  foto: Camera,
  smm: Megaphone,
};

/**
 * Kurs kartasi (v6 «Sokin»): hairline karta, soyasiz. Muqova yo'q bo'lsa —
 * tekis yuza + yo'nalish ikonkasi (SpecialistCard CoverPattern naqshi), bo'sh kulrang maydon emas.
 */
export function CourseCard({ c }: { c: CourseCardItem }) {
  const badge = courseBadge(c);
  const Icon = CATEGORY_ICON[c.category] ?? GraduationCap;
  return (
    <Link href={`/mentorlik/${c.slug}`} className="card card-hover m-plain group flex h-full flex-col overflow-hidden max-sm:flex-row max-sm:items-center max-sm:gap-3 max-sm:px-4 max-sm:py-3">
      <div className="relative aspect-[16/9] overflow-hidden max-sm:aspect-square max-sm:w-[76px] max-sm:shrink-0 max-sm:self-start max-sm:overflow-hidden max-sm:rounded-[12px]">
        {c.coverUrl ? (
          <SafeImage src={c.coverUrl} alt={c.title} width={480} height={270} className="img-zoom h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center bg-fg/[0.04] text-fg-4" aria-hidden>
            <Icon size={26} />
          </span>
        )}
        <span className="absolute left-2 top-2 rounded-md bg-ink/80 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white max-sm:hidden">{levelLabel(c.level)}</span>
        {badge && <span className={cn("absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide max-sm:hidden", BADGE_CLS[badge.tone])}>{badge.label}</span>}
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-3.5 max-sm:p-0">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-fg-4">{categoryLabel(c.category)}</span>
        <h3 className="mt-1 line-clamp-2 min-h-[2.6em] text-[15px] font-bold leading-snug text-fg max-sm:mt-0.5 max-sm:min-h-0">
          {c.title}
          {badge && <span className={cn("ml-1.5 inline-block align-middle rounded px-1 py-px text-[10px] font-bold uppercase tracking-wide sm:hidden", BADGE_CLS[badge.tone])}>{badge.label}</span>}
        </h3>
        {c.summary && <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-fg-3 max-sm:hidden">{c.summary}</p>}
        <div className="mt-3 flex items-center gap-2 max-sm:mt-1">
          <Avatar name={c.mentor.name} src={c.mentor.avatarUrl} size={22} decorative />
          <span className="min-w-0 flex-1 truncate text-[12.5px] text-fg-2">{c.mentor.name}</span>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-2.5 text-[12px] text-fg-4 max-sm:mt-1 max-sm:border-0 max-sm:pt-0">
          <span className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1">
              <GraduationCap size={12} /> {c.lessonsCount}
            </span>
            {c.totalMin ? <span className="inline-flex items-center gap-1"><Clock size={12} /> {formatDuration(c.totalMin)}</span> : null}
            {c.studentsCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <Users size={12} /> {c.studentsCount}
              </span>
            )}
            {c.rating > 0 && (
              <span className="inline-flex items-center gap-1">
                <Star size={12} className="fill-fg text-fg" /> {c.rating}
              </span>
            )}
          </span>
          <span className={cn("shrink-0 font-bold", c.priceFrom ? "text-fg" : "text-success-text")}>{formatSom(c.priceFrom)}</span>
        </div>
      </div>
    </Link>
  );
}

/**
 * Mini karta — gorizontal karusel uchun (Udemy «Mashhur» qatori): 16:9 muqova, 2 qatorli sarlavha, ustoz, reyting/narx.
 * Telefonda ham karta ko'rinishida (m-plain emas — qator bo'ylab aylanadi).
 */
export function CourseMiniCard({ c }: { c: CourseCardItem }) {
  const Icon = CATEGORY_ICON[c.category] ?? GraduationCap;
  const badge = courseBadge(c);
  return (
    <Link href={`/mentorlik/${c.slug}`} className="card card-hover group flex h-full w-[220px] flex-col overflow-hidden">
      <div className="relative aspect-[16/9] overflow-hidden bg-surface-2">
        {c.coverUrl ? (
          <SafeImage src={c.coverUrl} alt="" width={440} height={248} className="img-zoom h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-fg/[0.04]">
            <Icon size={26} className="text-fg-4" aria-hidden />
          </div>
        )}
        {c.priceFrom === 0 && <span className="absolute left-2 top-2 rounded-md bg-success px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white">Bepul</span>}
        {badge && <span className={cn("absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide", BADGE_CLS[badge.tone])}>{badge.label}</span>}
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-3">
        <h3 className="line-clamp-2 min-h-[2.5em] text-[13.5px] font-bold leading-snug text-fg">{c.title}</h3>
        <p className="mt-1 truncate text-[12px] text-fg-3">{c.mentor.name}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-[12px] text-fg-4">
          <span className="inline-flex items-center gap-2">
            {c.rating > 0 && (
              <span className="inline-flex items-center gap-0.5 font-semibold text-fg">
                <Star size={11} className="fill-accent text-accent" /> {c.rating}
              </span>
            )}
            <span>{c.totalMin ? formatDuration(c.totalMin) : `${c.lessonsCount} dars`}</span>
          </span>
          <span className={cn("font-bold", c.priceFrom ? "text-fg" : "text-success-text")}>{formatSom(c.priceFrom)}</span>
        </div>
      </div>
    </Link>
  );
}
