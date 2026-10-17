import Link from "next/link";
import { BadgeCheck, MapPin, Wallet } from "lucide-react";
import { Avatar } from "@/components/ui";
import { RESUME_EXPERIENCE, RESUME_FORMAT, professionLabel, salaryLabel, vacancyRegionLabel } from "@/lib/vacancies/format";
import type { ResumeCard as ResumeCardData } from "@/lib/vacancies/service";
import { cn, timeAgo } from "@/lib/utils";

/** Rezyume kartasi (/rezyumelar): kontaktsiz — aloqa sayt ichidagi chat orqali */
export function ResumeCard({ r, className }: { r: ResumeCardData; className?: string }) {
  return (
    <article className={cn("card card-hover card-link group relative flex h-full min-w-0 flex-col p-4 sm:p-5", className)}>
      <div className="flex items-center gap-3">
        <Avatar name={r.user.name} src={r.user.avatarUrl} size={44} decorative />
        <div className="min-w-0">
          <h2 className="font-display text-[16px] font-semibold leading-snug text-fg">
            <Link href={`/rezyumelar/${r.id}`} className="after:absolute after:inset-0 after:rounded-[inherit] underline-offset-4 group-hover:underline">
              {r.title}
            </Link>
          </h2>
          <p className="inline-flex items-center gap-1 truncate text-[13px] text-fg-2">
            {r.user.name}
            {r.user.emailVerified && <BadgeCheck size={13} className="text-success-text" aria-label="Email tasdiqlangan" />}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px] font-semibold">
        <span className="rounded-full bg-fg/6 px-2.5 py-1 text-fg-2">{professionLabel(r.profession, true)}</span>
        <span className="rounded-full border border-line px-2.5 py-1 text-fg-2">{RESUME_EXPERIENCE[r.experience]}</span>
        <span className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-fg-2">
          <MapPin size={12} aria-hidden /> {r.format === "remote" ? RESUME_FORMAT.remote : `${RESUME_FORMAT[r.format]} · ${vacancyRegionLabel(r.regionSlug)}`}
        </span>
      </div>
      {r.summary && <p className="mt-2.5 line-clamp-2 text-[13.5px] leading-relaxed text-fg-2">{r.summary}</p>}
      {r.skills.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Ko'nikmalar">
          {r.skills.slice(0, 5).map((s) => (
            <li key={s} className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-fg-2">
              {s}
            </li>
          ))}
          {r.skills.length > 5 && <li className="rounded-full px-1.5 py-1 text-[12px] font-medium text-fg-3">+{r.skills.length - 5}</li>}
        </ul>
      )}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3.5 text-[12.5px] text-fg-3">
        <span className="inline-flex items-center gap-1.5 font-semibold text-fg">
          <Wallet size={14} className="text-accent" aria-hidden /> {salaryLabel(r.expectedSalary, null)}
        </span>
        <span suppressHydrationWarning>Yangilangan: {timeAgo(r.updatedAt)}</span>
      </div>
    </article>
  );
}
