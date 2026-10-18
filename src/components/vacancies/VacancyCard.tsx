import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { WORK_FORMAT, professionLabel, salaryLabel, vacancyRegionLabel } from "@/lib/vacancies/format";
import type { VacancyCard as VacancyCardData } from "@/lib/vacancies/service";
import { cn, timeAgo } from "@/lib/utils";

/** Shuncha soatdan yangi e'lonlar "Yangi" belgisi bilan */
const NEW_HOURS = 48;

/**
 * Vakansiya kartasi (/vakansiyalar, bosh sahifa, kabinet) — faqat asosiysi: format, lavozim, kompaniya · kasb,
 * maosh, vaqt. Butun karta — havola. Ko'nikmalar, bandlik va arizalar soni — vakansiya sahifasida.
 */
export function VacancyCard({ v, className, headingLevel = "h2", href }: { v: VacancyCardData; className?: string; headingLevel?: "h2" | "h3"; href?: string }) {
  const Heading = headingLevel;
  const remote = v.format === "remote";
  const isNew = Date.now() - v.createdAt < NEW_HOURS * 3_600_000;
  return (
    <article className={cn("card card-hover card-link group relative flex h-full min-w-0 flex-col p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-center gap-1.5 text-[12px] font-semibold">
        {isNew && <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-1 text-white">Yangi</span>}
        <span className={cn("inline-flex items-center rounded-full px-2.5 py-1", remote ? "bg-info-soft text-info-text" : "border border-line text-fg-2")}>
          {remote ? WORK_FORMAT.remote : `${WORK_FORMAT[v.format]} · ${vacancyRegionLabel(v.regionSlug)}`}
        </span>
      </div>

      <Heading className="mt-3 font-display text-[17px] font-semibold leading-snug tracking-[-0.01em] text-fg sm:text-[18px]">
        <Link href={href ?? `/vakansiyalar/${v.id}`} className="after:absolute after:inset-0 after:rounded-[inherit] decoration-1 underline-offset-4 group-hover:underline">
          {v.title}
        </Link>
      </Heading>
      <p className="mt-1 flex min-w-0 items-center gap-1 text-[13px] text-fg-2">
        <span className="truncate">{v.company || v.author.name}</span>
        {v.author.emailVerified && <BadgeCheck size={13} className="shrink-0 text-success-text" aria-label="Email tasdiqlangan" />}
        <span className="shrink-0 text-fg-4">· {professionLabel(v.profession, true)}</span>
      </p>

      <div className="mt-auto flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-line pt-3.5">
        <p className="font-display text-[16px] font-semibold text-fg">
          {salaryLabel(v.salaryMin, v.salaryMax)}
          {(v.salaryMin || v.salaryMax) && <span className="ml-1 text-[12px] font-medium text-fg-3">/ oy</span>}
        </p>
        <p className="text-[12px] text-fg-3" suppressHydrationWarning>
          {timeAgo(v.createdAt)}
        </p>
      </div>
    </article>
  );
}
