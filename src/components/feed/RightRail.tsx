import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Briefcase, MapPinned, RadioTower, UsersRound } from "lucide-react";
import { Avatar, VerifiedBadge } from "@/components/ui";
import { FollowButton } from "@/components/groups/FollowButton";
import { CATEGORY_BY_SLUG } from "@/lib/constants";
import { tr, type Locale } from "@/lib/i18n";
import { FEED } from "@/lib/i18n/dict/feed";
import type { RailData } from "@/lib/feed";
import { professionLabel, salaryLabel } from "@/lib/vacancies/format";
import { formatDateTime } from "@/lib/utils";

export interface RailUser {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: string;
  specialistSlug: string | null;
}

/** O'ng panel (desktop): mening kartam, tavsiya ijodkorlar (obuna tugmasi bilan), faol jamoalar, yangi vakansiyalar, efir, xarita */
export function RightRail({ data, user, til }: { data: RailData; user: RailUser | null; til: Locale }) {
  const { creators, groups, vacancies, official } = data;
  return (
    <div className="space-y-4">
      {user && (
        <div className="card flex items-center gap-3 p-3.5">
          <Avatar name={user.name} src={user.avatarUrl} size={44} decorative />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-fg">{user.name}</p>
            <Link href={user.specialistSlug ? `/mutaxassislar/${user.specialistSlug}` : "/kabinet"} className="text-[12.5px] font-medium text-accent-text hover:underline">
              {tr(til, user.specialistSlug ? FEED.myProfile : FEED.cabinet)}
            </Link>
          </div>
        </div>
      )}

      {official && (
        <div className="card p-4">
          <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-fg-3">
            <BadgeCheck size={13} className="text-accent" /> {official.group.name}
          </p>
          {official.next?.eventAt ? (
            <p className="mt-2 flex items-center gap-1.5 text-[13.5px] font-semibold text-fg">
              <RadioTower size={14} className="text-accent" /> {tr(til, FEED.nextLive)}: {formatDateTime(official.next.eventAt)}
            </p>
          ) : (
            <p className="mt-2 line-clamp-2 text-[13px] text-fg-2">{official.group.description}</p>
          )}
          <Link href={`/jamoalar/${official.group.slug}`} className="icon-nudge mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-fg hover:underline">
            {tr(til, FEED.openChannel)} <ArrowUpRight size={14} />
          </Link>
        </div>
      )}

      {creators.length > 0 && (
        <section className="card p-4" aria-labelledby="rail-creators">
          <div className="flex items-center justify-between">
            <h2 id="rail-creators" className="text-[13px] font-bold text-fg-2">
              {tr(til, FEED.suggested)}
            </h2>
            <Link href="/mutaxassislar" className="text-[12px] font-semibold text-fg-3 hover:text-fg">
              {tr(til, FEED.seeAll)}
            </Link>
          </div>
          <ul className="mt-3 space-y-3">
            {creators.map((c) => (
              <li key={c.userId} className="flex items-center gap-3">
                <Link href={`/mutaxassislar/${c.slug}`} className="shrink-0">
                  <Avatar name={c.name} src={c.avatarUrl} size={40} decorative />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/mutaxassislar/${c.slug}`} className="flex items-center gap-1 truncate text-[13.5px] font-semibold text-fg hover:underline">
                    {c.name} {c.isVerified && <VerifiedBadge size={13} />}
                  </Link>
                  <p className="truncate text-[12px] text-fg-3">{CATEGORY_BY_SLUG[c.category]?.name ?? c.title}</p>
                </div>
                <FollowButton userId={c.userId} initialFollowing={c.following} initialCount={c.followers} loggedIn={Boolean(user)} size="sm" compact showCount={false} variant="outline" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {groups.length > 0 && (
        <section className="card p-4" aria-labelledby="rail-groups">
          <div className="flex items-center justify-between">
            <h2 id="rail-groups" className="text-[13px] font-bold text-fg-2">
              {tr(til, FEED.activeGroups)}
            </h2>
            <Link href="/jamoalar" className="text-[12px] font-semibold text-fg-3 hover:text-fg">
              {tr(til, FEED.seeAll)}
            </Link>
          </div>
          <ul className="mt-3 space-y-2.5">
            {groups.map((g) => (
              <li key={g.id}>
                <Link href={`/jamoalar/${g.slug}`} className="flex items-center gap-3 rounded-[12px] transition hover:bg-fg/4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-accent-soft text-accent-text">
                    <UsersRound size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-fg">{g.name}</span>
                    <span className="block text-[12px] text-fg-3">{FEED.members[til](g.membersCount)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {vacancies.length > 0 && (
        <section className="card p-4" aria-labelledby="rail-vac">
          <div className="flex items-center justify-between">
            <h2 id="rail-vac" className="text-[13px] font-bold text-fg-2">
              {tr(til, FEED.newVacancies)}
            </h2>
            <Link href="/vakansiyalar" className="text-[12px] font-semibold text-fg-3 hover:text-fg">
              {tr(til, FEED.seeAll)}
            </Link>
          </div>
          <ul className="mt-3 space-y-2.5">
            {vacancies.map((v) => (
              <li key={v.id}>
                <Link href={`/vakansiyalar/${v.id}`} className="flex items-start gap-3 rounded-[12px] transition hover:bg-fg/4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-fg/6 text-fg-2">
                    <Briefcase size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-fg">{v.title}</span>
                    <span className="block truncate text-[12px] text-fg-3">
                      {v.company || professionLabel(v.profession, true)} · {salaryLabel(v.salaryMin, v.salaryMax)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link href="/xarita" className="card card-hover icon-nudge flex items-center gap-3 p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-ink text-ink-fg">
          <MapPinned size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-fg">{tr(til, FEED.mapCard)}</span>
          <span className="block text-[12px] leading-snug text-fg-3">{tr(til, FEED.mapCardText)}</span>
        </span>
        <ArrowUpRight size={16} className="shrink-0 text-fg-3" />
      </Link>
    </div>
  );
}
