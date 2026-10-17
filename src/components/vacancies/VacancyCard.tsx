import Link from "next/link";
import { BadgeCheck, Building2, Clock3, MapPin, Users, Wallet } from "lucide-react";
import { EMPLOYMENT, EXPERIENCE, WORK_FORMAT, professionLabel, salaryLabel, vacancyRegionLabel } from "@/lib/vacancies/format";
import type { VacancyCard as VacancyCardData } from "@/lib/vacancies/service";
import { cn, timeAgo } from "@/lib/utils";

const MAX_SKILLS = 4;
/** Shuncha soatdan yangi e'lonlar "Yangi" belgisi bilan */
const NEW_HOURS = 48;

/** Vakansiya kartasi (/vakansiyalar, bosh sahifa, kabinet): butun karta — havola */
export function VacancyCard({ v, className, headingLevel = "h2", href }: { v: VacancyCardData; className?: string; headingLevel?: "h2" | "h3"; href?: string }) {
  const Heading = headingLevel;
  const extra = v.skills.length - MAX_SKILLS;
  const remote = v.format === "remote";
  const isNew = Date.now() - v.createdAt < NEW_HOURS * 3_600_000;
  return (
    <article className={cn("card card-hover card-link group relative flex h-full min-w-0 flex-col p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-center gap-1.5 text-[12px] font-semibold">
        {isNew && <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-1 text-white">Yangi</span>}
        <span className="inline-flex items-center rounded-full bg-fg/6 px-2.5 py-1 text-fg-2">{professionLabel(v.profession, true)}</span>
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1", remote ? "bg-info-soft text-info-text" : "border border-line text-fg-2")}>
          <MapPin size={12} aria-hidden />
          {remote ? WORK_FORMAT.remote : `${WORK_FORMAT[v.format]} · ${vacancyRegionLabel(v.regionSlug)}`}
        </span>
        <span className="inline-flex items-center rounded-full border border-line px-2.5 py-1 text-fg-2">{EMPLOYMENT[v.employment]}</span>
      </div>

      <Heading className="mt-3 font-display text-[17px] font-semibold leading-snug tracking-[-0.01em] text-fg sm:text-[18px]">
        <Link href={href ?? `/vakansiyalar/${v.id}`} className="after:absolute after:inset-0 after:rounded-[inherit] decoration-1 underline-offset-4 group-hover:underline">
          {v.title}
        </Link>
      </Heading>
      <p className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-fg-2">
        <Building2 size={13} className="text-fg-3" aria-hidden />
        {v.company || v.author.name}
        {v.author.emailVerified && <BadgeCheck size={13} className="text-success-text" aria-label="Email tasdiqlangan" />}
        <span className="text-fg-4">· {EXPERIENCE[v.experience]}</span>
      </p>

      {v.skills.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Ko'nikmalar">
          {v.skills.slice(0, MAX_SKILLS).map((s) => (
            <li key={s} className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-fg-2">
              {s}
            </li>
          ))}
          {extra > 0 && <li className="rounded-full px-1.5 py-1 text-[12px] font-medium text-fg-3">+{extra}</li>}
        </ul>
      )}

      <div className="mt-auto pt-4">
        <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2 border-t border-line pt-3.5">
          <p className="inline-flex items-center gap-1.5 font-display text-[16px] font-semibold text-fg">
            <Wallet size={15} className="text-accent" aria-hidden />
            {salaryLabel(v.salaryMin, v.salaryMax)}
            {(v.salaryMin || v.salaryMax) && <span className="text-[12px] font-medium text-fg-3">/ oy</span>}
          </p>
          <p className="inline-flex items-center gap-1 text-[12.5px] font-medium text-fg-2">
            <Users size={13} className="text-fg-3" aria-hidden />
            {v.applicationsCount} ta ariza
          </p>
        </div>
        <p className="mt-2 inline-flex items-center gap-1 text-[12px] text-fg-3" suppressHydrationWarning>
          <Clock3 size={12} aria-hidden />
          {timeAgo(v.createdAt)}
        </p>
      </div>
    </article>
  );
}
