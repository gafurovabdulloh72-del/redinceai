import Link from "next/link";
import { BadgeCheck, Clock3, MapPin, MessageSquareText, Wallet } from "lucide-react";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { CATEGORY_BY_SLUG } from "@/lib/constants";
import { tr, type Locale } from "@/lib/i18n";
import { timeAgoLabel } from "@/lib/i18n/dict/catalog";
import { ISHLAR, budgetLabelTr, proposalsCountTr } from "@/lib/i18n/dict/jobs";
import { budgetLabel, jobRegionLabel } from "@/lib/jobs/format";
import { cn } from "@/lib/utils";

export interface JobCardData {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  regionSlug: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  budgetType: "fixed" | "hourly";
  skills: string[];
  proposalsCount: number;
  createdAt: Date | string;
  client: { firstName: string; emailVerified: boolean };
}

const MAX_SKILLS = 4;

/**
 * E'lon kartasi (/ishlar, bosh sahifa): butun karta — havola (after:inset-0).
 * Klient (JobForm preview) ham ishlatadi — shuning uchun til PROP orqali keladi
 * (server: getLocale(), klient: useLocale()); getLocale import qilinmaydi.
 */
export function JobCard({ job, til = "uz", className, headingLevel = "h2" }: { job: JobCardData; til?: Locale; className?: string; headingLevel?: "h2" | "h3" }) {
  const cat = CATEGORY_BY_SLUG[job.category];
  const Heading = headingLevel;
  const extra = job.skills.length - MAX_SKILLS;
  const remote = !job.regionSlug;
  return (
    <article className={cn("card card-hover card-link group relative flex h-full min-w-0 flex-col p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-center gap-1.5 text-[12px] font-semibold">
        {cat && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-fg/6 px-2.5 py-1 text-fg-2">
            <CategoryIcon icon={cat.icon} size={12} aria-hidden="true" />
            {cat.name}
          </span>
        )}
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1", remote ? "bg-info-soft text-info-text" : "border border-line text-fg-2")}>
          <MapPin size={12} aria-hidden="true" />
          {remote ? tr(til, ISHLAR.f.remote) : jobRegionLabel(job.regionSlug)}
        </span>
      </div>

      <Heading className="mt-3 font-display text-[17px] font-semibold leading-snug tracking-[-0.01em] text-fg sm:text-[18px]">
        <Link href={`/ishlar/${job.id}`} className="after:absolute after:inset-0 after:rounded-[inherit] decoration-1 underline-offset-4 group-hover:underline">
          {job.title}
        </Link>
      </Heading>
      <p className="mt-1.5 line-clamp-2 text-[14px] leading-relaxed text-fg-2">{job.excerpt}</p>

      {job.skills.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={tr(til, ISHLAR.card.skillsAria)}>
          {job.skills.slice(0, MAX_SKILLS).map((s) => (
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
            <Wallet size={15} className="text-accent" aria-hidden="true" />
            {budgetLabelTr(til, budgetLabel(job.budgetMin, job.budgetMax, job.budgetType))}
          </p>
          <p className="inline-flex items-center gap-1 text-[12.5px] font-medium text-fg-2">
            <MessageSquareText size={13} className="text-fg-3" aria-hidden="true" />
            {proposalsCountTr(til, job.proposalsCount)}
          </p>
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-fg-3">
          <span className="inline-flex items-center gap-1" suppressHydrationWarning>
            <Clock3 size={12} aria-hidden="true" />
            {timeAgoLabel(til, job.createdAt)}
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1">
            {job.client.firstName}
            {job.client.emailVerified && (
              <span title={tr(til, ISHLAR.card.emailVerified)} className="inline-flex">
                <BadgeCheck size={13} className="text-success-text" aria-label={tr(til, ISHLAR.card.emailVerified)} role="img" />
              </span>
            )}
          </span>
        </p>
      </div>
    </article>
  );
}
