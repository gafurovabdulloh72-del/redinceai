import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { Avatar } from "@/components/ui";
import { RESUME_EXPERIENCE, RESUME_FORMAT, professionLabel, salaryLabel, vacancyRegionLabel } from "@/lib/vacancies/format";
import type { ResumeCard as ResumeCardData } from "@/lib/vacancies/service";
import { cn, timeAgo } from "@/lib/utils";

const MAX_SKILLS = 4;

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
          <p className="flex min-w-0 items-center gap-1 text-[13px] text-fg-2">
            <span className="truncate">{r.user.name}</span>
            {r.user.emailVerified && <BadgeCheck size={13} className="shrink-0 text-success-text" aria-label="Email tasdiqlangan" />}
          </p>
        </div>
      </div>
      <p className="mt-3 text-[12.5px] text-fg-3">
        {professionLabel(r.profession, true)} · {RESUME_EXPERIENCE[r.experience]} · {r.format === "remote" ? RESUME_FORMAT.remote : `${RESUME_FORMAT[r.format]} · ${vacancyRegionLabel(r.regionSlug)}`}
      </p>
      {r.skills.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Ko'nikmalar">
          {r.skills.slice(0, MAX_SKILLS).map((s) => (
            <li key={s} className="rounded-full border border-line px-2.5 py-1 text-[12px] font-medium text-fg-2">
              {s}
            </li>
          ))}
          {r.skills.length > MAX_SKILLS && <li className="px-1 py-1 text-[12px] font-medium text-fg-3">+{r.skills.length - MAX_SKILLS}</li>}
        </ul>
      )}
      <div className="mt-auto flex flex-wrap items-baseline justify-between gap-2 border-t border-line pt-3.5 text-[12.5px] text-fg-3">
        <span className="font-display text-[15px] font-semibold text-fg">{salaryLabel(r.expectedSalary, null)}</span>
        <span suppressHydrationWarning>{timeAgo(r.updatedAt)}</span>
      </div>
    </article>
  );
}
